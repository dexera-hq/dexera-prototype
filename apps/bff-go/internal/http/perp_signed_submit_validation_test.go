package http

import (
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

const anvilKey0 = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

func mustPrivateKeyFromHex(t *testing.T, key string) *ecdsa.PrivateKey {
	t.Helper()
	privateKey, err := crypto.HexToECDSA(strings.TrimSpace(key))
	if err != nil {
		t.Fatalf("expected private key decode to succeed, got err=%v", err)
	}
	return privateKey
}

func signTypedDataForTest(t *testing.T, privateKey *ecdsa.PrivateKey, typedDataJSON string) string {
	t.Helper()

	var typedData apitypes.TypedData
	if err := json.Unmarshal([]byte(typedDataJSON), &typedData); err != nil {
		t.Fatalf("expected typed data decode to succeed, got err=%v", err)
	}

	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		t.Fatalf("expected typed data domain hash to succeed, got err=%v", err)
	}
	payloadHash, err := typedData.HashStruct(typedData.PrimaryType, typedData.Message)
	if err != nil {
		t.Fatalf("expected typed data payload hash to succeed, got err=%v", err)
	}

	rawData := []byte{0x19, 0x01}
	rawData = append(rawData, domainSeparator...)
	rawData = append(rawData, payloadHash...)
	digest := crypto.Keccak256Hash(rawData)

	rawSignature, err := crypto.Sign(digest.Bytes(), privateKey)
	if err != nil {
		t.Fatalf("expected signature generation to succeed, got err=%v", err)
	}
	rawSignature[64] += 27
	return "0x" + hex.EncodeToString(rawSignature)
}

func buildTestHyperliquidUnsignedExchangeRequest() map[string]any {
	return map[string]any{
		"action": map[string]any{
			"type": "order",
			"orders": []any{
				map[string]any{
					"a": 0,
					"b": true,
					"p": "68500",
					"s": "0.05",
					"r": false,
					"t": map[string]any{
						"limit": map[string]any{
							"tif": "Gtc",
						},
					},
				},
			},
			"grouping": "na",
		},
		"nonce": time.Now().UTC().UnixMilli(),
	}
}

func TestRecoverHyperliquidTypedDataSignerReturnsRequestedAndRecoveredSigner(t *testing.T) {
	unsignedExchangeRequest := buildTestHyperliquidUnsignedExchangeRequest()
	typedDataJSON, _, err := buildHyperliquidSignTypedData(unsignedExchangeRequest, false)
	if err != nil {
		t.Fatalf("expected typed data generation to succeed, got err=%v", err)
	}

	key := mustPrivateKeyFromHex(t, anvilKey0)
	address := strings.ToLower(crypto.PubkeyToAddress(key.PublicKey).Hex())
	signature := signTypedDataForTest(t, key, typedDataJSON)

	recoveredSigner, requestedSigner, err := recoverHyperliquidTypedDataSigner(
		signature,
		walletRequestPayload{
			Method: "eth_signTypedData_v4",
			Params: []any{address, typedDataJSON},
		},
	)
	if err != nil {
		t.Fatalf("expected signer recovery to succeed, got err=%v", err)
	}
	if recoveredSigner != address {
		t.Fatalf("expected recovered signer %s, got %s", address, recoveredSigner)
	}
	if requestedSigner != address {
		t.Fatalf("expected requested signer %s, got %s", address, requestedSigner)
	}
}

func TestHyperliquidSubmitSignedActionRejectsRecoveredSignerMismatch(t *testing.T) {
	unsignedExchangeRequest := buildTestHyperliquidUnsignedExchangeRequest()
	typedDataJSON, _, err := buildHyperliquidSignTypedData(unsignedExchangeRequest, false)
	if err != nil {
		t.Fatalf("expected typed data generation to succeed, got err=%v", err)
	}

	accountKey := mustPrivateKeyFromHex(t, anvilKey0)
	accountAddress := strings.ToLower(crypto.PubkeyToAddress(accountKey.PublicKey).Hex())
	wrongSignerKey, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("expected wrong signer key generation to succeed, got err=%v", err)
	}
	signature := signTypedDataForTest(t, wrongSignerKey, typedDataJSON)

	adapter := &hyperliquidAdapter{}
	_, err = adapter.SubmitSignedAction(
		httptest.NewRequest("POST", "/api/v1/perp/actions/submit", nil),
		submitSignedActionRequest{
			OrderID:   "ord_hl_sig_mismatch_001",
			Signature: signature,
			UnsignedActionPayload: unsignedActionPayload{
				ID:        "uap_hl_sig_mismatch_001",
				AccountID: accountAddress,
				Venue:     venueHyperliquid,
				Kind:      "perp_order_action",
				Action:    unsignedExchangeRequest,
				WalletRequest: walletRequestPayload{
					Method: "eth_signTypedData_v4",
					Params: []any{accountAddress, typedDataJSON},
				},
			},
		},
	)
	if err == nil {
		t.Fatal("expected submit to fail for signer mismatch")
	}
	if !strings.Contains(err.Error(), "recovered signer") {
		t.Fatalf("expected recovered signer mismatch error, got %v", err)
	}
}

func TestHyperliquidSubmitSignedActionRetriesAlternateSignatureV(t *testing.T) {
	unsignedExchangeRequest := buildTestHyperliquidUnsignedExchangeRequest()
	typedDataJSON, _, err := buildHyperliquidSignTypedData(unsignedExchangeRequest, false)
	if err != nil {
		t.Fatalf("expected typed data generation to succeed, got err=%v", err)
	}

	key := mustPrivateKeyFromHex(t, anvilKey0)
	address := strings.ToLower(crypto.PubkeyToAddress(key.PublicKey).Hex())
	signature := signTypedDataForTest(t, key, typedDataJSON)

	var requests int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("expected valid JSON payload, got err=%v", err)
		}
		signaturePayload, ok := body["signature"].(map[string]any)
		if !ok {
			t.Fatalf("expected signature payload map, got %T", body["signature"])
		}
		v, ok := signaturePayload["v"].(float64)
		if !ok {
			t.Fatalf("expected signature.v to be numeric, got %T", signaturePayload["v"])
		}
		if int(v) < 27 {
			writeJSON(w, http.StatusOK, map[string]any{
				"status":   "err",
				"response": "User or API Wallet 0xdeadbeef does not exist.",
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"response": map[string]any{
				"type": "order",
				"data": map[string]any{
					"statuses": []any{
						map[string]any{
							"resting": map[string]any{
								"oid": 123456789,
							},
						},
					},
				},
			},
		})
	}))
	defer upstream.Close()

	adapter := &hyperliquidAdapter{
		baseURL:    upstream.URL,
		httpClient: &http.Client{Timeout: 2 * time.Second},
		isMainnet:  false,
	}
	submission, err := adapter.SubmitSignedAction(
		httptest.NewRequest("POST", "/api/v1/perp/actions/submit", nil),
		submitSignedActionRequest{
			OrderID:   "ord_hl_sig_retry_001",
			Signature: signature,
			UnsignedActionPayload: unsignedActionPayload{
				ID:        "uap_hl_sig_retry_001",
				AccountID: address,
				Venue:     venueHyperliquid,
				Kind:      "perp_order_action",
				Action:    unsignedExchangeRequest,
				WalletRequest: walletRequestPayload{
					Method: "eth_signTypedData_v4",
					Params: []any{address, typedDataJSON},
				},
			},
		},
	)
	if err != nil {
		t.Fatalf("expected submit to succeed after alternate v retry, got err=%v", err)
	}
	if submission.Status != "submitted" {
		t.Fatalf("expected status=submitted, got %s", submission.Status)
	}
	if atomic.LoadInt32(&requests) != 2 {
		t.Fatalf("expected two upstream attempts, got %d", atomic.LoadInt32(&requests))
	}
}
