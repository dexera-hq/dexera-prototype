package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

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

func TestQuoteHandler(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/quote":
			if r.Header.Get("X-API-Key") != "test-api-key" {
				t.Fatalf("expected X-API-Key header to be set")
			}
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("expected valid JSON request body, got err=%v", err)
			}
			if body["tokenIn"] != "0x1111111111111111111111111111111111111111" {
				t.Fatalf("expected tokenIn mapping, got %v", body["tokenIn"])
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"requestId": "quote_uni_001",
				"quote": map[string]any{
					"output": map[string]any{
						"amount":    "1234500000000000000",
						"minAmount": "1220000000000000000",
					},
					"route": []any{
						[]any{
							map[string]any{
								"type":    "v3-pool",
								"address": "0x9999999999999999999999999999999999999999",
								"tokenIn": map[string]any{
									"address":  "0x1111111111111111111111111111111111111111",
									"chainId":  1,
									"decimals": 18,
									"symbol":   "WETH",
								},
								"tokenOut": map[string]any{
									"address":  "0x2222222222222222222222222222222222222222",
									"chainId":  1,
									"decimals": 6,
									"symbol":   "USDC",
								},
							},
						},
					},
					"gasFee":      "2100000000000000",
					"gasFeeQuote": "4.20",
					"gasFeeUSD":   "4.20",
					"fees": []any{
						map[string]any{
							"type":      "protocol",
							"amount":    "1000000000000000",
							"token":     "0x2222222222222222222222222222222222222222",
							"bips":      "30",
							"recipient": "0x3333333333333333333333333333333333333333",
						},
					},
				},
				"permit2Address": "0x4444444444444444444444444444444444444444",
			})
		case "/check_approval":
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("expected valid JSON request body, got err=%v", err)
			}
			if body["spender"] != "0x4444444444444444444444444444444444444444" {
				t.Fatalf("expected spender from quote payload, got %v", body["spender"])
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"token":   "0x1111111111111111111111111111111111111111",
				"spender": "0x4444444444444444444444444444444444444444",
				"approval": map[string]any{
					"to":                   "0x1111111111111111111111111111111111111111",
					"data":                 "0xdeadbeef",
					"value":                "0",
					"gasLimit":             "50000",
					"maxFeePerGas":         "30000000000",
					"maxPriorityFeePerGas": "2000000000",
				},
			})
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}
	}))
	defer upstream.Close()

	t.Setenv("UNISWAP_TRADING_API_KEY", "test-api-key")
	t.Setenv("UNISWAP_TRADING_API_BASE_URL", upstream.URL)

	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "0x1111111111111111111111111111111111111111",
		"buyToken": "0x2222222222222222222222222222222222222222",
		"sellAmount": "1000000000000000000",
		"wallet": "0xabc"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quotes", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	quoteID, ok := res["quoteId"].(string)
	if !ok || quoteID == "" {
		t.Fatalf("expected quoteId to be a non-empty string, got %T (%v)", res["quoteId"], res["quoteId"])
	}
	if res["source"] != "uniswap" {
		t.Fatalf("expected source=uniswap, got %v", res["source"])
	}
	if res["amountOut"] != "1234500000000000000" {
		t.Fatalf("expected amountOut to be mapped, got %v", res["amountOut"])
	}
	if res["minOut"] != "1220000000000000000" {
		t.Fatalf("expected minOut to be mapped, got %v", res["minOut"])
	}
	route, ok := res["route"].([]any)
	if !ok || len(route) == 0 {
		t.Fatalf("expected route hops in response")
	}
	firstHop, ok := route[0].(map[string]any)
	if !ok {
		t.Fatalf("expected first route hop to be an object")
	}
	if firstHop["tokenIn"] != "0x1111111111111111111111111111111111111111" {
		t.Fatalf("expected normalized tokenIn address, got %v", firstHop["tokenIn"])
	}
	if firstHop["tokenOut"] != "0x2222222222222222222222222222222222222222" {
		t.Fatalf("expected normalized tokenOut address, got %v", firstHop["tokenOut"])
	}
	fees, ok := res["fees"].(map[string]any)
	if !ok {
		t.Fatalf("expected fees object in response")
	}
	feeItems, ok := fees["items"].([]any)
	if !ok || len(feeItems) == 0 {
		t.Fatalf("expected fee items in response")
	}
	requiredApprovals, ok := res["requiredApprovals"].([]any)
	if !ok || len(requiredApprovals) != 1 {
		t.Fatalf("expected exactly one required approval, got %v", res["requiredApprovals"])
	}
}

func TestQuoteHandlerMissingAPIKey(t *testing.T) {
	t.Setenv("UNISWAP_TRADING_API_KEY", "")
	t.Setenv("UNISWAP_TRADING_API_BASE_URL", "http://127.0.0.1:1")

	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "0x1111111111111111111111111111111111111111",
		"buyToken": "0x2222222222222222222222222222222222222222",
		"sellAmount": "1000000000000000000",
		"wallet": "0xabc"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quotes", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", rr.Code)
	}
}

func TestQuoteHandlerReturnsBadGatewayWhenQuoteUpstreamFails(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/quote" {
			http.Error(w, "upstream unavailable", http.StatusBadGateway)
			return
		}
		http.Error(w, "unexpected path", http.StatusNotFound)
	}))
	defer upstream.Close()

	t.Setenv("UNISWAP_TRADING_API_KEY", "test-api-key")
	t.Setenv("UNISWAP_TRADING_API_BASE_URL", upstream.URL)

	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "0x1111111111111111111111111111111111111111",
		"buyToken": "0x2222222222222222222222222222222222222222",
		"sellAmount": "1000000000000000000",
		"wallet": "0xabc"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quotes", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected status 502, got %d", rr.Code)
	}
}

func TestQuoteHandlerReturnsBadGatewayWhenApprovalUpstreamFails(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/quote":
			writeJSON(w, http.StatusOK, map[string]any{
				"requestId": "quote_uni_001",
				"quote": map[string]any{
					"output": map[string]any{
						"amount": "1234500000000000000",
					},
				},
			})
		case "/check_approval":
			http.Error(w, "upstream unavailable", http.StatusBadGateway)
		default:
			http.Error(w, "unexpected path", http.StatusNotFound)
		}
	}))
	defer upstream.Close()

	t.Setenv("UNISWAP_TRADING_API_KEY", "test-api-key")
	t.Setenv("UNISWAP_TRADING_API_BASE_URL", upstream.URL)

	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "0x1111111111111111111111111111111111111111",
		"buyToken": "0x2222222222222222222222222222222222222222",
		"sellAmount": "1000000000000000000",
		"wallet": "0xabc"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quotes", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected status 502, got %d", rr.Code)
	}
}

func TestQuoteHandlerPassesThroughClientErrorWhenQuoteUpstreamFails(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/quote" {
			http.Error(w, "unsupported token", http.StatusUnprocessableEntity)
			return
		}
		http.Error(w, "unexpected path", http.StatusNotFound)
	}))
	defer upstream.Close()

	t.Setenv("UNISWAP_TRADING_API_KEY", "test-api-key")
	t.Setenv("UNISWAP_TRADING_API_BASE_URL", upstream.URL)

	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "0x1111111111111111111111111111111111111111",
		"buyToken": "0x2222222222222222222222222222222222222222",
		"sellAmount": "1000000000000000000",
		"wallet": "0xabc"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quotes", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d", rr.Code)
	}
}

func TestQuoteHandlerPassesThroughClientErrorWhenApprovalUpstreamFails(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/quote":
			writeJSON(w, http.StatusOK, map[string]any{
				"requestId": "quote_uni_001",
				"quote": map[string]any{
					"output": map[string]any{
						"amount": "1234500000000000000",
					},
				},
			})
		case "/check_approval":
			http.Error(w, "invalid spender", http.StatusBadRequest)
		default:
			http.Error(w, "unexpected path", http.StatusNotFound)
		}
	}))
	defer upstream.Close()

	t.Setenv("UNISWAP_TRADING_API_KEY", "test-api-key")
	t.Setenv("UNISWAP_TRADING_API_BASE_URL", upstream.URL)

	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "0x1111111111111111111111111111111111111111",
		"buyToken": "0x2222222222222222222222222222222222222222",
		"sellAmount": "1000000000000000000",
		"wallet": "0xabc"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quotes", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestBuildTransactionHandler(t *testing.T) {
	body := bytes.NewBufferString(`{
		"quoteId": "quote_mock_001",
		"wallet": "0xabc",
		"chainId": 8453
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/transactions/build", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	unsignedTx, ok := res["unsignedTx"].(map[string]any)
	if !ok {
		t.Fatalf("expected unsignedTx object in response")
	}
	to, ok := unsignedTx["to"].(string)
	if !ok || to == "" {
		t.Fatalf("expected unsignedTx.to to be a non-empty string, got %T (%v)", unsignedTx["to"], unsignedTx["to"])
	}
	chainID, ok := unsignedTx["chainId"].(float64)
	if !ok || int(chainID) != 8453 {
		t.Fatalf("expected unsignedTx.chainId=8453, got %v", unsignedTx["chainId"])
	}
}

func TestPositionsHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/positions?wallet=0xabc&chainId=1", nil)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("expected valid JSON body: %v", err)
	}
	positions, ok := res["positions"].([]any)
	if !ok {
		t.Fatalf("expected positions list in response")
	}
	if len(positions) == 0 {
		t.Fatalf("expected at least one position")
	}
}

func TestPositionsHandlerMissingWallet(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/positions", nil)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestQuoteHandlerRejectsUnknownFields(t *testing.T) {
	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "ETH",
		"buyToken": "USDC",
		"sellAmount": "1000000000000000000",
		"wallet": "0xabc",
		"unexpected": "field"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quotes", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestBuildTransactionHandlerRejectsUnknownFields(t *testing.T) {
	body := bytes.NewBufferString(`{
		"quoteId": "quote_mock_001",
		"wallet": "0xabc",
		"chainId": 1,
		"unexpected": "field"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/transactions/build", body)
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}
