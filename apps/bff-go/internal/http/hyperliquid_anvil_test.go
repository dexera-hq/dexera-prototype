package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"
)

const anvilDefaultAccount = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"

func TestHyperliquidSubmitSignedActionWithAnvilSignature(t *testing.T) {
	anvilRPCURL := strings.TrimSpace(os.Getenv("ANVIL_RPC_URL"))
	if anvilRPCURL == "" {
		t.Skip("ANVIL_RPC_URL not set")
	}

	unsignedExchangeRequest := map[string]any{
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

	typedDataJSON, _, err := buildHyperliquidSignTypedData(unsignedExchangeRequest, false)
	if err != nil {
		t.Fatalf("expected typed data generation to succeed, got err=%v", err)
	}

	signature, err := signTypedDataWithAnvil(
		anvilRPCURL,
		anvilDefaultAccount,
		typedDataJSON,
	)
	if err != nil {
		t.Fatalf("expected typed data signing to succeed, got err=%v", err)
	}
	expectedSignature, err := parseHyperliquidWalletSignature(signature)
	if err != nil {
		t.Fatalf("expected signature parsing to succeed, got err=%v", err)
	}

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/exchange" {
			t.Fatalf("expected path /exchange, got %s", r.URL.Path)
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("expected valid json body, got err=%v", err)
		}

		signatureRecord, ok := body["signature"].(map[string]any)
		if !ok {
			t.Fatalf("expected signature object in payload, got %T", body["signature"])
		}
		if signatureRecord["r"] != expectedSignature["r"] {
			t.Fatalf("expected signature.r=%v, got %v", expectedSignature["r"], signatureRecord["r"])
		}
		if signatureRecord["s"] != expectedSignature["s"] {
			t.Fatalf("expected signature.s=%v, got %v", expectedSignature["s"], signatureRecord["s"])
		}
		if signatureRecord["v"] != expectedSignature["v"] {
			t.Fatalf("expected signature.v=%v, got %v", expectedSignature["v"], signatureRecord["v"])
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"response": map[string]any{
				"type": "order",
				"data": map[string]any{
					"statuses": []any{
						map[string]any{
							"resting": map[string]any{
								"oid": 918273645,
							},
						},
					},
				},
			},
		})
	}))
	defer upstream.Close()

	t.Setenv("HYPERLIQUID_API_BASE_URL", upstream.URL)
	t.Setenv("HYPERLIQUID_NETWORK", "testnet")

	adapter, err := newHyperliquidAdapterFromEnv()
	if err != nil {
		t.Fatalf("expected adapter creation to succeed, got err=%v", err)
	}

	submission, err := adapter.SubmitSignedAction(
		httptest.NewRequest(http.MethodPost, "/api/v1/perp/actions/submit", nil),
		submitSignedActionRequest{
			OrderID:   "ord_hl_anvil_001",
			Signature: signature,
			UnsignedActionPayload: unsignedActionPayload{
				ID:        "uap_hl_anvil_001",
				AccountID: anvilDefaultAccount,
				Venue:     venueHyperliquid,
				Kind:      "perp_order_action",
				Action:    unsignedExchangeRequest,
				WalletRequest: walletRequestPayload{
					Method: "eth_signTypedData_v4",
				},
			},
		},
	)
	if err != nil {
		t.Fatalf("expected signed submission to succeed, got err=%v", err)
	}

	if submission.Status != "submitted" {
		t.Fatalf("expected status=submitted, got %s", submission.Status)
	}
	if submission.ActionHash == "" || !strings.HasPrefix(submission.ActionHash, "0x") {
		t.Fatalf("expected non-empty actionHash, got %q", submission.ActionHash)
	}
	if submission.VenueOrderID == nil || *submission.VenueOrderID != "918273645" {
		t.Fatalf("expected venueOrderId=918273645, got %v", submission.VenueOrderID)
	}
}

func signTypedDataWithAnvil(rpcURL string, account string, typedDataJSON string) (string, error) {
	requestPayload := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "eth_signTypedData_v4",
		"params":  []any{account, typedDataJSON},
	}
	body, err := json.Marshal(requestPayload)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(rpcURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var rpcResponse struct {
		Result string `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rpcResponse); err != nil {
		return "", err
	}
	if rpcResponse.Error != nil {
		return "", fmt.Errorf(
			"rpc error %d: %s",
			rpcResponse.Error.Code,
			rpcResponse.Error.Message,
		)
	}
	if strings.TrimSpace(rpcResponse.Result) == "" {
		return "", fmt.Errorf("rpc %s returned empty result", strconv.Quote("eth_signTypedData_v4"))
	}

	return rpcResponse.Result, nil
}
