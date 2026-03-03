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
	body := bytes.NewBufferString(`{
		"chainId": 1,
		"sellToken": "ETH",
		"buyToken": "USDC",
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
	if res["source"] != "mock" {
		t.Fatalf("expected source=mock, got %v", res["source"])
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
