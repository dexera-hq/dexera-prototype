package http

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type fakeVenueAdapter struct {
	previewResponse  perpOrderPreviewResponse
	previewError     error
	unsignedResponse buildUnsignedActionResponse
	unsignedError    error
	submitResponse   submitSignedActionResponse
	submitError      error
	positionsResp    perpPositionsResponse
	positionsErr     error
	eligibilityResp  walletVenueEligibilityResult
	eligibilityErr   error
}

func (a fakeVenueAdapter) PreviewOrder(_ *http.Request, _ buildUnsignedActionRequest) (perpOrderPreviewResponse, error) {
	return a.previewResponse, a.previewError
}

func (a fakeVenueAdapter) BuildUnsignedAction(_ *http.Request, _ buildUnsignedActionRequest) (buildUnsignedActionResponse, error) {
	return a.unsignedResponse, a.unsignedError
}

func (a fakeVenueAdapter) SubmitSignedAction(_ *http.Request, _ submitSignedActionRequest) (submitSignedActionResponse, error) {
	return a.submitResponse, a.submitError
}

func (a fakeVenueAdapter) GetPositions(_ *http.Request, _ perpPositionsQuery) (perpPositionsResponse, error) {
	return a.positionsResp, a.positionsErr
}

func (a fakeVenueAdapter) CheckWalletEligibility(_ *http.Request, _ string) (walletVenueEligibilityResult, error) {
	return a.eligibilityResp, a.eligibilityErr
}

func validBuildUnsignedActionBody(venue string) *bytes.Buffer {
	return bytes.NewBufferString(`{
		"order": {
			"accountId": "acct_001",
			"venue": "` + venue + `",
			"instrument": "BTC-PERP",
			"side": "buy",
			"type": "limit",
			"size": "0.15",
			"limitPrice": "68500"
		}
	}`)
}

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status=ok, got %v", body["status"])
	}
}

func TestWalletChallengeAndVerifyFlow(t *testing.T) {
	previousChallenges := walletChallenges
	walletChallenges = newWalletChallengeStore(func() time.Time {
		return time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	})
	defer func() {
		walletChallenges = previousChallenges
	}()

	address := "0x0000000000000000000000000000000000000002"
	challengeReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/wallet/challenge",
		bytes.NewBufferString(`{"address":"`+address+`"}`),
	)
	challengeReq.Header.Set("Content-Type", "application/json")
	challengeRes := httptest.NewRecorder()

	NewMux().ServeHTTP(challengeRes, challengeReq)

	if challengeRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", challengeRes.Code, challengeRes.Body.String())
	}

	var challengeBody map[string]any
	if err := json.Unmarshal(challengeRes.Body.Bytes(), &challengeBody); err != nil {
		t.Fatalf("expected valid challenge response JSON: %v", err)
	}

	challengeID, _ := challengeBody["challengeId"].(string)
	if strings.TrimSpace(challengeID) == "" {
		t.Fatalf("expected non-empty challengeId, got %v", challengeBody["challengeId"])
	}
	if !strings.Contains(challengeBody["message"].(string), "Dexera Wallet Verification") {
		t.Fatalf("expected challenge message to include verification header")
	}

	verifyReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/wallet/verify",
		bytes.NewBufferString(`{
			"address":"`+address+`",
			"challengeId":"`+challengeID+`",
			"signature":"0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b",
			"venue":"aster"
		}`),
	)
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyRes := httptest.NewRecorder()

	NewMux().ServeHTTP(verifyRes, verifyReq)

	if verifyRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", verifyRes.Code, verifyRes.Body.String())
	}

	var verifyBody map[string]any
	if err := json.Unmarshal(verifyRes.Body.Bytes(), &verifyBody); err != nil {
		t.Fatalf("expected valid verify response JSON: %v", err)
	}

	if verifyBody["ownershipVerified"] != true {
		t.Fatalf("expected ownershipVerified=true, got %v", verifyBody["ownershipVerified"])
	}
	if verifyBody["venue"] != "aster" {
		t.Fatalf("expected venue=aster, got %v", verifyBody["venue"])
	}
	if verifyBody["eligible"] != true {
		t.Fatalf("expected eligible=true for even nibble test address, got %v", verifyBody["eligible"])
	}
}

func TestWalletVerifyRejectsReusedChallenge(t *testing.T) {
	previousChallenges := walletChallenges
	walletChallenges = newWalletChallengeStore(func() time.Time {
		return time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	})
	defer func() {
		walletChallenges = previousChallenges
	}()

	address := "0x0000000000000000000000000000000000000002"
	challengeReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/wallet/challenge",
		bytes.NewBufferString(`{"address":"`+address+`"}`),
	)
	challengeReq.Header.Set("Content-Type", "application/json")
	challengeRes := httptest.NewRecorder()
	NewMux().ServeHTTP(challengeRes, challengeReq)

	var challengeBody map[string]any
	if err := json.Unmarshal(challengeRes.Body.Bytes(), &challengeBody); err != nil {
		t.Fatalf("expected valid challenge response JSON: %v", err)
	}

	challengeID, _ := challengeBody["challengeId"].(string)
	verifyBody := `{
		"address":"` + address + `",
		"challengeId":"` + challengeID + `",
		"signature":"0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b",
		"venue":"aster"
	}`

	firstReq := httptest.NewRequest(http.MethodPost, "/api/v1/wallet/verify", bytes.NewBufferString(verifyBody))
	firstReq.Header.Set("Content-Type", "application/json")
	firstRes := httptest.NewRecorder()
	NewMux().ServeHTTP(firstRes, firstReq)
	if firstRes.Code != http.StatusOK {
		t.Fatalf("expected first verify status 200, got %d body=%s", firstRes.Code, firstRes.Body.String())
	}

	secondReq := httptest.NewRequest(http.MethodPost, "/api/v1/wallet/verify", bytes.NewBufferString(verifyBody))
	secondReq.Header.Set("Content-Type", "application/json")
	secondRes := httptest.NewRecorder()
	NewMux().ServeHTTP(secondRes, secondReq)
	if secondRes.Code != http.StatusBadRequest {
		t.Fatalf("expected second verify status 400 for challenge reuse, got %d", secondRes.Code)
	}
}

func TestWalletVerifyNormalizesVenueForAdapterResolution(t *testing.T) {
	previousChallenges := walletChallenges
	walletChallenges = newWalletChallengeStore(func() time.Time {
		return time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	})
	previousResolver := venueAdapterResolver
	venueAdapterResolver = func(venue venueID) (perpVenueAdapter, error) {
		if venue != venueAster {
			t.Fatalf("expected normalized venueAster, got %s", venue)
		}
		return fakeVenueAdapter{
			eligibilityResp: walletVenueEligibilityResult{
				Eligible: true,
				Source:   "",
			},
		}, nil
	}
	defer func() {
		walletChallenges = previousChallenges
		venueAdapterResolver = previousResolver
	}()

	address := "0x0000000000000000000000000000000000000002"
	challengeReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/wallet/challenge",
		bytes.NewBufferString(`{"address":"`+address+`"}`),
	)
	challengeReq.Header.Set("Content-Type", "application/json")
	challengeRes := httptest.NewRecorder()
	NewMux().ServeHTTP(challengeRes, challengeReq)

	var challengeBody map[string]any
	if err := json.Unmarshal(challengeRes.Body.Bytes(), &challengeBody); err != nil {
		t.Fatalf("expected valid challenge response JSON: %v", err)
	}

	challengeID, _ := challengeBody["challengeId"].(string)
	verifyReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/wallet/verify",
		bytes.NewBufferString(`{
			"address":"`+address+`",
			"challengeId":"`+challengeID+`",
			"signature":"0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b",
			"venue":"ASTER"
		}`),
	)
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyRes := httptest.NewRecorder()
	NewMux().ServeHTTP(verifyRes, verifyReq)

	if verifyRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", verifyRes.Code, verifyRes.Body.String())
	}

	var verifyBody map[string]any
	if err := json.Unmarshal(verifyRes.Body.Bytes(), &verifyBody); err != nil {
		t.Fatalf("expected valid verify response JSON: %v", err)
	}
	if verifyBody["venue"] != "aster" {
		t.Fatalf("expected normalized venue=aster, got %v", verifyBody["venue"])
	}
	if verifyBody["source"] != "aster" {
		t.Fatalf("expected normalized source=aster, got %v", verifyBody["source"])
	}
}

func TestPlaceholderHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/placeholder", nil)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	if body["source"] != "bff-go" {
		t.Fatalf("expected source=bff-go, got %v", body["source"])
	}
}

func TestPerpOrderPreviewAsterMock(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/orders/preview",
		validBuildUnsignedActionBody("aster"),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rr.Code, rr.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	if body["venue"] != "aster" {
		t.Fatalf("expected venue=aster, got %v", body["venue"])
	}
	if body["instrument"] != "BTC-PERP" {
		t.Fatalf("expected instrument binding to be preserved, got %v", body["instrument"])
	}
}

func TestPerpOrderPreviewNormalizesVenueForAdapterResolution(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/orders/preview",
		validBuildUnsignedActionBody("ASTER"),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d with body %s", rr.Code, rr.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	if body["venue"] != "aster" {
		t.Fatalf("expected normalized venue=aster, got %v", body["venue"])
	}
}

func TestBuildUnsignedActionAsterMock(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/unsigned",
		validBuildUnsignedActionBody("aster"),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}

	if body["signingPolicy"] != "client-signing-only" {
		t.Fatalf("expected client-signing-only policy, got %v", body["signingPolicy"])
	}

	unsignedPayload, ok := body["unsignedActionPayload"].(map[string]any)
	if !ok {
		t.Fatalf("expected unsignedActionPayload object, got %T", body["unsignedActionPayload"])
	}

	if unsignedPayload["accountId"] != "acct_001" {
		t.Fatalf("expected accountId binding to be preserved, got %v", unsignedPayload["accountId"])
	}
	if unsignedPayload["venue"] != "aster" {
		t.Fatalf("expected venue binding to be preserved, got %v", unsignedPayload["venue"])
	}
	if unsignedPayload["kind"] != "perp_order_action" {
		t.Fatalf("expected kind=perp_order_action, got %v", unsignedPayload["kind"])
	}
	walletRequest, ok := unsignedPayload["walletRequest"].(map[string]any)
	if !ok {
		t.Fatalf("expected walletRequest object, got %T", unsignedPayload["walletRequest"])
	}
	if walletRequest["method"] != "wallet_perp_submitAction" {
		t.Fatalf("expected walletRequest method, got %v", walletRequest["method"])
	}
}

func TestBuildUnsignedActionNormalizesVenueForAdapterResolution(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/unsigned",
		validBuildUnsignedActionBody("ASTER"),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	unsignedPayload, ok := body["unsignedActionPayload"].(map[string]any)
	if !ok {
		t.Fatalf("expected unsignedActionPayload object, got %T", body["unsignedActionPayload"])
	}
	if unsignedPayload["venue"] != "aster" {
		t.Fatalf("expected normalized venue=aster, got %v", unsignedPayload["venue"])
	}
	walletRequest, ok := unsignedPayload["walletRequest"].(map[string]any)
	if !ok {
		t.Fatalf("expected walletRequest object, got %T", unsignedPayload["walletRequest"])
	}
	if walletRequest["method"] == "" {
		t.Fatalf("expected walletRequest method to be non-empty")
	}
}

func TestPerpPositionsHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/perp/positions?accountId=acct_001&venue=aster", nil)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}

	if body["accountId"] != "acct_001" {
		t.Fatalf("expected accountId=acct_001, got %v", body["accountId"])
	}
	if body["venue"] != "aster" {
		t.Fatalf("expected venue=aster, got %v", body["venue"])
	}
}

func TestPerpPositionsHandlerMissingAccount(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/perp/positions?venue=aster", nil)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestBuildUnsignedActionRejectsInvalidPayload(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/unsigned",
		bytes.NewBufferString(`{"order":{"accountId":"acct_001","venue":"aster","instrument":"BTC-PERP","side":"buy","type":"limit","size":"1"}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "limit orders must include limitPrice") {
		t.Fatalf("expected limitPrice validation error, got %q", rr.Body.String())
	}
}

func TestPerpOrderPreviewRejectsUnknownFields(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/orders/preview",
		bytes.NewBufferString(`{"order":{"accountId":"acct_001","venue":"aster","instrument":"BTC-PERP","side":"buy","type":"limit","size":"1","limitPrice":"68000","unexpected":true}}`),
	)
	arr := httptest.NewRecorder()

	NewMux().ServeHTTP(arr, req)

	if arr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", arr.Code)
	}
}

func TestHyperliquidPreviewUsesVenueAdapter(t *testing.T) {
	previousResolver := venueAdapterResolver
	venueAdapterResolver = func(venue venueID) (perpVenueAdapter, error) {
		if venue != venueHyperliquid {
			t.Fatalf("expected venueHyperliquid, got %s", venue)
		}
		return fakeVenueAdapter{
			previewResponse: perpOrderPreviewResponse{
				PreviewID:         "prv_hl_001",
				AccountID:         "acct_001",
				Venue:             venueHyperliquid,
				Instrument:        "BTC-PERP",
				Side:              "buy",
				Type:              "limit",
				Size:              "0.15",
				EstimatedNotional: "10274.29",
				EstimatedFee:      "6.16",
				ExpiresAt:         "2026-01-01T00:00:00Z",
				Source:            "hyperliquid",
			},
		}, nil
	}
	defer func() {
		venueAdapterResolver = previousResolver
	}()

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/orders/preview",
		validBuildUnsignedActionBody("hyperliquid"),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	if body["source"] != "hyperliquid" {
		t.Fatalf("expected source=hyperliquid, got %v", body["source"])
	}
	if body["previewId"] != "prv_hl_001" {
		t.Fatalf("expected previewId from upstream, got %v", body["previewId"])
	}
}

func TestHyperliquidBuildUnsignedActionIncludesWalletRequest(t *testing.T) {
	previousResolver := venueAdapterResolver
	venueAdapterResolver = func(venue venueID) (perpVenueAdapter, error) {
		if venue != venueHyperliquid {
			t.Fatalf("expected venueHyperliquid, got %s", venue)
		}
		return fakeVenueAdapter{
			unsignedResponse: buildUnsignedActionResponse{
				OrderID:       "ord_hl_001",
				SigningPolicy: "client-signing-only",
				Disclaimer:    clientSigningOnlyDisclaimer,
				UnsignedActionPayload: unsignedActionPayload{
					ID:        "uap_hl_001",
					AccountID: "acct_001",
					Venue:     venueHyperliquid,
					Kind:      "perp_order_action",
					Action: map[string]any{
						"instrument": "BTC-PERP",
					},
					WalletRequest: walletRequestPayload{
						Method: "eth_signTypedData_v4",
						Params: []any{
							map[string]any{"payloadId": "uap_hl_001"},
						},
					},
				},
			},
		}, nil
	}
	defer func() {
		venueAdapterResolver = previousResolver
	}()

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/unsigned",
		validBuildUnsignedActionBody("hyperliquid"),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}

	unsignedPayload, ok := body["unsignedActionPayload"].(map[string]any)
	if !ok {
		t.Fatalf("expected unsignedActionPayload object, got %T", body["unsignedActionPayload"])
	}
	walletRequest, ok := unsignedPayload["walletRequest"].(map[string]any)
	if !ok {
		t.Fatalf("expected walletRequest object, got %T", unsignedPayload["walletRequest"])
	}
	if walletRequest["method"] != "eth_signTypedData_v4" {
		t.Fatalf("expected walletRequest method, got %v", walletRequest["method"])
	}
}

func TestHyperliquidBuildUnsignedActionRejectsMissingWalletRequest(t *testing.T) {
	previousResolver := venueAdapterResolver
	venueAdapterResolver = func(venue venueID) (perpVenueAdapter, error) {
		if venue != venueHyperliquid {
			t.Fatalf("expected venueHyperliquid, got %s", venue)
		}
		return fakeVenueAdapter{
			unsignedError: errors.New("unsigned action is missing a wallet request envelope"),
		}, nil
	}
	defer func() {
		venueAdapterResolver = previousResolver
	}()

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/unsigned",
		validBuildUnsignedActionBody("hyperliquid"),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected status 502, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestHyperliquidAdapterDoesNotRequireAPIKey(t *testing.T) {
	t.Setenv("HYPERLIQUID_API_BASE_URL", "https://api.hyperliquid.xyz")
	t.Setenv("HYPERLIQUID_NETWORK", "")

	adapter, err := newHyperliquidAdapterFromEnv()
	if err != nil {
		t.Fatalf("expected adapter without API key, got err=%v", err)
	}
	if adapter.baseURL != "https://api.hyperliquid.xyz" {
		t.Fatalf("expected base URL to be preserved, got %s", adapter.baseURL)
	}
}

func TestHyperliquidAdapterUsesNetworkToggleForTestnet(t *testing.T) {
	t.Setenv("HYPERLIQUID_API_BASE_URL", "")
	t.Setenv("HYPERLIQUID_NETWORK", "testnet")

	adapter, err := newHyperliquidAdapterFromEnv()
	if err != nil {
		t.Fatalf("expected adapter with testnet toggle, got err=%v", err)
	}
	if adapter.baseURL != "https://api.hyperliquid-testnet.xyz" {
		t.Fatalf("expected testnet URL, got %s", adapter.baseURL)
	}
}

func TestHyperliquidAdapterRejectsUnknownNetworkToggle(t *testing.T) {
	t.Setenv("HYPERLIQUID_API_BASE_URL", "")
	t.Setenv("HYPERLIQUID_NETWORK", "staging")

	if _, err := newHyperliquidAdapterFromEnv(); err == nil {
		t.Fatalf("expected invalid network toggle to return an error")
	}
}

func TestHyperliquidEligibilityRejectsMissingUserRole(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/info" {
			t.Fatalf("expected path /info, got %s", r.URL.Path)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("expected JSON body, got err=%v", err)
		}
		if body["type"] != "userRole" {
			t.Fatalf("expected payload type=userRole, got %v", body["type"])
		}
		if body["user"] != "0x0000000000000000000000000000000000000002" {
			t.Fatalf("expected payload user address, got %v", body["user"])
		}
		writeJSON(w, http.StatusOK, map[string]any{"role": "Missing"})
	}))
	defer upstream.Close()

	t.Setenv("HYPERLIQUID_API_BASE_URL", upstream.URL)
	t.Setenv("HYPERLIQUID_NETWORK", "")

	adapter, err := newHyperliquidAdapterFromEnv()
	if err != nil {
		t.Fatalf("expected adapter creation to succeed, got err=%v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/wallet/verify", nil)
	result, err := adapter.CheckWalletEligibility(
		req,
		"0x0000000000000000000000000000000000000002",
	)
	if err != nil {
		t.Fatalf("expected successful userRole lookup, got err=%v", err)
	}
	if result.Eligible {
		t.Fatalf("expected eligible=false when userRole is Missing")
	}
	if !strings.Contains(result.Reason, "not registered") {
		t.Fatalf("expected not-registered reason, got %q", result.Reason)
	}
}

func TestHyperliquidEligibilityChecksClearinghouseStateAfterUserRole(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/info" {
			t.Fatalf("expected path /info, got %s", r.URL.Path)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("expected JSON body, got err=%v", err)
		}

		switch requestCount {
		case 1:
			if body["type"] != "userRole" {
				t.Fatalf("expected first request type=userRole, got %v", body["type"])
			}
			writeJSON(w, http.StatusOK, map[string]any{"role": "User"})
		case 2:
			if body["type"] != "clearinghouseState" {
				t.Fatalf("expected second request type=clearinghouseState, got %v", body["type"])
			}
			writeJSON(w, http.StatusOK, map[string]any{"assetPositions": []any{}})
		default:
			t.Fatalf("unexpected extra request #%d", requestCount)
		}
	}))
	defer upstream.Close()

	t.Setenv("HYPERLIQUID_API_BASE_URL", upstream.URL)
	t.Setenv("HYPERLIQUID_NETWORK", "")

	adapter, err := newHyperliquidAdapterFromEnv()
	if err != nil {
		t.Fatalf("expected adapter creation to succeed, got err=%v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/wallet/verify", nil)
	result, err := adapter.CheckWalletEligibility(
		req,
		"0x0000000000000000000000000000000000000002",
	)
	if err != nil {
		t.Fatalf("expected eligibility check to succeed, got err=%v", err)
	}
	if !result.Eligible {
		t.Fatalf("expected eligible=true for user role with valid clearinghouse response, got reason=%q", result.Reason)
	}
	if requestCount != 2 {
		t.Fatalf("expected exactly 2 upstream calls, got %d", requestCount)
	}
}

func TestHyperliquidPositionsPassesThroughClientErrors(t *testing.T) {
	previousResolver := venueAdapterResolver
	venueAdapterResolver = func(venue venueID) (perpVenueAdapter, error) {
		if venue != venueHyperliquid {
			t.Fatalf("expected venueHyperliquid, got %s", venue)
		}
		return fakeVenueAdapter{
			positionsErr: &upstreamHTTPError{
				op:         "/v1/perp/positions",
				statusCode: http.StatusUnprocessableEntity,
			},
		}, nil
	}
	defer func() {
		venueAdapterResolver = previousResolver
	}()

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/perp/positions?accountId=acct_001&venue=hyperliquid",
		nil,
	)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d", rr.Code)
	}
}

func TestSubmitSignedActionHyperliquid(t *testing.T) {
	previousResolver := venueAdapterResolver
	venueAdapterResolver = func(venue venueID) (perpVenueAdapter, error) {
		if venue != venueHyperliquid {
			t.Fatalf("expected venueHyperliquid, got %s", venue)
		}
		return fakeVenueAdapter{
			submitResponse: submitSignedActionResponse{
				OrderID:      "ord_hl_001",
				ActionHash:   "0xabc123",
				Venue:        venueHyperliquid,
				Status:       "submitted",
				VenueOrderID: stringPtr("918273645"),
				Source:       "hyperliquid",
			},
		}, nil
	}
	defer func() {
		venueAdapterResolver = previousResolver
	}()

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/submit",
		bytes.NewBufferString(`{
			"orderId":"ord_hl_001",
			"signature":"0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b",
			"unsignedActionPayload":{
				"id":"uap_hl_001",
				"accountId":"0x0000000000000000000000000000000000000002",
				"venue":"HYPERLIQUID",
				"kind":"perp_order_action",
				"action":{
					"action":{"type":"order","orders":[{"a":0}]},
					"nonce":1733000000000
				},
				"walletRequest":{"method":"eth_signTypedData_v4"}
			}
		}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	if body["orderId"] != "ord_hl_001" {
		t.Fatalf("expected orderId=ord_hl_001, got %v", body["orderId"])
	}
	if body["actionHash"] != "0xabc123" {
		t.Fatalf("expected actionHash=0xabc123, got %v", body["actionHash"])
	}
	if body["status"] != "submitted" {
		t.Fatalf("expected status=submitted, got %v", body["status"])
	}
}

func TestSubmitSignedActionRejectsInvalidSignature(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/submit",
		bytes.NewBufferString(`{
			"orderId":"ord_hl_001",
			"signature":"0x1234",
			"unsignedActionPayload":{
				"id":"uap_hl_001",
				"accountId":"0x0000000000000000000000000000000000000002",
				"venue":"hyperliquid",
				"kind":"perp_order_action",
				"action":{
					"action":{"type":"order","orders":[{"a":0}]},
					"nonce":1733000000000
				},
				"walletRequest":{"method":"eth_signTypedData_v4"}
			}
		}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestSubmitSignedActionAsterNotSupported(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/perp/actions/submit",
		bytes.NewBufferString(`{
			"orderId":"ord_as_001",
			"signature":"0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b",
			"unsignedActionPayload":{
				"id":"uap_as_001",
				"accountId":"0x0000000000000000000000000000000000000002",
				"venue":"aster",
				"kind":"perp_order_action",
				"action":{
					"action":{"type":"order","orders":[{"a":0}]},
					"nonce":1733000000000
				},
				"walletRequest":{"method":"wallet_perp_submitAction"}
			}
		}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusNotImplemented {
		t.Fatalf("expected status 501, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func stringPtr(value string) *string {
	return &value
}
