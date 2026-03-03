package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestBuildUnsignedTransactionHandler(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/transactions/unsigned",
		strings.NewReader(`{"order":{"walletAddress":"0x1111","chainId":1,"symbol":"ETH/USDT","side":"buy","type":"limit","quantity":"1.5","limitPrice":"2845.32"}}`),
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

	unsignedPayload, ok := body["unsignedTxPayload"].(map[string]any)
	if !ok {
		t.Fatalf("expected unsignedTxPayload object, got %T", body["unsignedTxPayload"])
	}

	for _, forbiddenField := range []string{"from", "signature", "rawTransaction", "signedTransaction", "txHash"} {
		if _, exists := unsignedPayload[forbiddenField]; exists {
			t.Fatalf("expected unsigned payload to omit %s", forbiddenField)
		}
	}
}

func TestBuildUnsignedTransactionHandlerRejectsInvalidPayload(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/transactions/unsigned",
		strings.NewReader(`{"order":{"walletAddress":"0x1111","chainId":1,"symbol":"ETH/USDT","side":"buy","type":"limit","quantity":"1.5"}}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	NewMux().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}
