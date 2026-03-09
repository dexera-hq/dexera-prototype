package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	hyperliquid "github.com/sonirico/go-hyperliquid"
)

func TestExtractHyperliquidSubmissionDebugReason(t *testing.T) {
	t.Run("returns nil for successful submission", func(t *testing.T) {
		reason := extractHyperliquidSubmissionDebugReason(map[string]any{
			"status": "ok",
			"response": map[string]any{
				"type": "order",
				"data": map[string]any{
					"statuses": []any{
						map[string]any{
							"resting": map[string]any{"oid": 123},
						},
					},
				},
			},
		})

		if reason != nil {
			t.Fatalf("expected nil reason, got %q", *reason)
		}
	})

	t.Run("extracts top-level response error string", func(t *testing.T) {
		reason := extractHyperliquidSubmissionDebugReason(map[string]any{
			"status":   "err",
			"response": "User or API Wallet 0xabc does not exist.",
		})

		if reason == nil {
			t.Fatal("expected non-nil reason")
		}
		if *reason != "User or API Wallet 0xabc does not exist." {
			t.Fatalf("unexpected reason %q", *reason)
		}
	})

	t.Run("extracts nested order error", func(t *testing.T) {
		reason := extractHyperliquidSubmissionDebugReason(map[string]any{
			"status": "ok",
			"response": map[string]any{
				"data": map[string]any{
					"statuses": []any{
						map[string]any{
							"error": "Order must have minimum value of $10.",
						},
					},
				},
			},
		})

		if reason == nil {
			t.Fatal("expected non-nil reason")
		}
		if *reason != "Order must have minimum value of $10." {
			t.Fatalf("unexpected reason %q", *reason)
		}
	})

	t.Run("falls back to status when no response reason is provided", func(t *testing.T) {
		reason := extractHyperliquidSubmissionDebugReason(map[string]any{
			"status": "err",
		})

		if reason == nil {
			t.Fatal("expected non-nil reason")
		}
		if *reason != `upstream exchange returned status "err"` {
			t.Fatalf("unexpected reason %q", *reason)
		}
	})
}

func TestNormalizeHyperliquidOrderStatus(t *testing.T) {
	testCases := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "open stays open", input: "open", expected: "open"},
		{name: "triggered maps to open", input: "triggered", expected: "open"},
		{name: "filled stays filled", input: "filled", expected: "filled"},
		{name: "cancel variants map to cancelled", input: "reduceOnlyCanceled", expected: "cancelled"},
		{name: "reject variants map to rejected", input: "tickRejected", expected: "rejected"},
		{name: "unknown maps to submitted", input: "scheduled", expected: "submitted"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			actual := normalizeHyperliquidOrderStatus(testCase.input)
			if actual != testCase.expected {
				t.Fatalf("expected %s, got %s", testCase.expected, actual)
			}
		})
	}
}

func TestIsHyperliquidOrderStatusTerminal(t *testing.T) {
	if !isHyperliquidOrderStatusTerminal("filled") {
		t.Fatal("filled should be terminal")
	}
	if !isHyperliquidOrderStatusTerminal("cancelled") {
		t.Fatal("cancelled should be terminal")
	}
	if !isHyperliquidOrderStatusTerminal("rejected") {
		t.Fatal("rejected should be terminal")
	}
	if isHyperliquidOrderStatusTerminal("open") {
		t.Fatal("open should not be terminal")
	}
}

func TestExtractHyperliquidOrderStatusValue(t *testing.T) {
	t.Run("reads top-level status", func(t *testing.T) {
		actual := extractHyperliquidOrderStatusValue(map[string]any{"status": "filled"})
		if actual != "filled" {
			t.Fatalf("expected filled, got %s", actual)
		}
	})

	t.Run("reads nested order status payload", func(t *testing.T) {
		actual := extractHyperliquidOrderStatusValue(map[string]any{
			"status": "order",
			"order": map[string]any{
				"status": "open",
			},
		})
		if actual != "open" {
			t.Fatalf("expected open, got %s", actual)
		}
	})
}

func TestNormalizeHyperliquidPerpPriceWire(t *testing.T) {
	t.Run("rounds to hyperliquid perp price precision", func(t *testing.T) {
		price, err := normalizeHyperliquidPerpPriceWire(2743.123456, 4)
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		if price != "2743.1" {
			t.Fatalf("expected 2743.1, got %s", price)
		}
	})

	t.Run("rejects invalid non-positive price", func(t *testing.T) {
		_, err := normalizeHyperliquidPerpPriceWire(0, 4)
		if err == nil {
			t.Fatal("expected error for zero price")
		}
	})
}

func TestNormalizeActionForSigningHash(t *testing.T) {
	t.Run("canonicalizes cancel actions", func(t *testing.T) {
		normalized := normalizeActionForSigningHash(map[string]any{
			"type": "cancel",
			"cancels": []any{
				map[string]any{
					"a": 0,
					"o": 12345,
				},
			},
		})

		cancelAction, ok := normalized.(hyperliquid.CancelAction)
		if !ok {
			t.Fatalf("expected hyperliquid.CancelAction, got %T", normalized)
		}
		if cancelAction.Type != "cancel" {
			t.Fatalf("expected cancel type, got %s", cancelAction.Type)
		}
		if len(cancelAction.Cancels) != 1 || cancelAction.Cancels[0].OrderID != 12345 {
			t.Fatalf("expected cancel order id 12345, got %+v", cancelAction.Cancels)
		}
	})
}

func TestMapHyperliquidFill(t *testing.T) {
	t.Run("maps buy fill fields into perp fill response shape", func(t *testing.T) {
		fill := mapHyperliquidFill("0xabc123", hyperliquid.Fill{
			Coin:     "ETH",
			Side:     "B",
			Price:    "4307.4",
			Size:     "0.0025",
			Time:     1755857898644,
			Hash:     "0xhash",
			Oid:      37907159219,
			Fee:      "0.004845",
			FeeToken: "USDC",
			Tid:      1070455675927460,
		})

		if fill == nil {
			t.Fatal("expected non-nil fill")
		}
		if fill.Instrument != "ETH-PERP" {
			t.Fatalf("expected ETH-PERP, got %s", fill.Instrument)
		}
		if fill.Side != "buy" {
			t.Fatalf("expected buy, got %s", fill.Side)
		}
		if fill.OrderID != "37907159219" {
			t.Fatalf("expected order id from oid, got %s", fill.OrderID)
		}
		if fill.FeeAmount != "0.004845" {
			t.Fatalf("expected fee amount, got %s", fill.FeeAmount)
		}
		if fill.FeeAsset != "USDC" {
			t.Fatalf("expected fee asset, got %s", fill.FeeAsset)
		}
	})

	t.Run("falls back to direction when side shorthand is missing", func(t *testing.T) {
		fill := mapHyperliquidFill("0xabc123", hyperliquid.Fill{
			Coin:  "BTC",
			Dir:   "Close Long",
			Price: "68450.25",
			Size:  "0.01",
			Time:  1755857898644,
			Oid:   12345,
		})

		if fill == nil {
			t.Fatal("expected non-nil fill")
		}
		if fill.Side != "sell" {
			t.Fatalf("expected sell, got %s", fill.Side)
		}
	})
}

func TestHyperliquidGetPositionsUsesClearinghouseState(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/info" {
			t.Fatalf("expected path /info, got %s", r.URL.Path)
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("expected valid json body, got err=%v", err)
		}

		if body["type"] != "clearinghouseState" {
			t.Fatalf("expected type=clearinghouseState, got %v", body["type"])
		}
		if body["user"] != "0xabc123" {
			t.Fatalf("expected user=0xabc123, got %v", body["user"])
		}
		if _, exists := body["dex"]; exists {
			t.Fatalf("did not expect dex override in request body")
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"assetPositions": []any{
				map[string]any{
					"type": "oneWay",
					"position": map[string]any{
						"coin":           "BTC",
						"entryPx":        "68120.0",
						"leverage":       map[string]any{"type": "cross", "value": 4},
						"liquidationPx":  "60250.5",
						"marginUsed":     "4278.14",
						"positionValue":  "17112.56",
						"returnOnEquity": "0.0193",
						"szi":            "0.25",
						"unrealizedPnl":  "82.56",
					},
				},
				map[string]any{
					"type": "oneWay",
					"position": map[string]any{
						"coin":           "ETH",
						"entryPx":        "3221.8",
						"leverage":       map[string]any{"type": "cross", "value": 3},
						"positionValue":  "5120.24",
						"returnOnEquity": "0.0112",
						"szi":            "-1.6",
						"unrealizedPnl":  "34.64",
					},
				},
			},
			"marginSummary": map[string]any{
				"accountValue":    "25000.00",
				"totalMarginUsed": "8550.00",
				"totalNtlPos":     "22232.80",
				"totalRawUsd":     "25000.00",
			},
			"crossMarginSummary": map[string]any{
				"accountValue":    "25000.00",
				"totalMarginUsed": "8550.00",
				"totalNtlPos":     "22232.80",
				"totalRawUsd":     "25000.00",
			},
			"withdrawable": "16450.00",
		})
	}))
	defer upstream.Close()

	infoClient := hyperliquid.NewInfo(
		context.Background(),
		upstream.URL,
		true,
		&hyperliquid.Meta{},
		&hyperliquid.SpotMeta{},
		nil,
	)

	adapter := &hyperliquidAdapter{
		baseURL:    upstream.URL,
		httpClient: upstream.Client(),
		infoClient: infoClient,
		isMainnet:  true,
	}

	response, err := adapter.GetPositions(
		httptest.NewRequest(http.MethodGet, "/api/v1/perp/positions", nil),
		perpPositionsQuery{
			AccountID: "0xabc123",
			Venue:     venueHyperliquid,
		},
	)
	if err != nil {
		t.Fatalf("expected positions request to succeed, got err=%v", err)
	}

	if response.AccountID != "0xabc123" {
		t.Fatalf("expected accountId to round-trip, got %s", response.AccountID)
	}
	if response.Venue != venueHyperliquid {
		t.Fatalf("expected venueHyperliquid, got %s", response.Venue)
	}
	if response.Source != string(venueHyperliquid) {
		t.Fatalf("expected source=hyperliquid, got %s", response.Source)
	}
	if len(response.Positions) != 2 {
		t.Fatalf("expected two mapped positions, got %d", len(response.Positions))
	}

	first := response.Positions[0]
	if first.Instrument != "BTC-PERP" {
		t.Fatalf("expected BTC-PERP, got %s", first.Instrument)
	}
	if first.Direction != "long" {
		t.Fatalf("expected long, got %s", first.Direction)
	}
	if first.MarkPrice != "68450.24" && first.MarkPrice != "68450.25" {
		t.Fatalf("expected derived mark price near 68450.25, got %s", first.MarkPrice)
	}

	second := response.Positions[1]
	if second.Direction != "short" {
		t.Fatalf("expected short, got %s", second.Direction)
	}
	if second.Size != "1.6" {
		t.Fatalf("expected absolute size 1.6, got %s", second.Size)
	}
}

func TestHyperliquidGetPositionsFiltersByInstrument(t *testing.T) {
	payload := map[string]any{
		"assetPositions": []any{
			map[string]any{
				"type": "oneWay",
				"position": map[string]any{
					"coin":          "BTC",
					"entryPx":       "68120.0",
					"leverage":      map[string]any{"type": "cross", "value": 4},
					"positionValue": "17112.56",
					"szi":           "0.25",
					"unrealizedPnl": "82.56",
				},
			},
			map[string]any{
				"type": "oneWay",
				"position": map[string]any{
					"coin":          "ETH",
					"entryPx":       "3221.8",
					"leverage":      map[string]any{"type": "cross", "value": 3},
					"positionValue": "5120.24",
					"szi":           "-1.6",
					"unrealizedPnl": "34.64",
				},
			},
		},
		"marginSummary":      map[string]any{},
		"crossMarginSummary": map[string]any{},
		"withdrawable":       "0",
	}

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/info" {
			t.Fatalf("expected path /info, got %s", r.URL.Path)
		}
		writeJSON(w, http.StatusOK, payload)
	}))
	defer upstream.Close()

	adapter := &hyperliquidAdapter{
		baseURL:    upstream.URL,
		httpClient: upstream.Client(),
		infoClient: hyperliquid.NewInfo(
			context.Background(),
			upstream.URL,
			true,
			&hyperliquid.Meta{},
			&hyperliquid.SpotMeta{},
			nil,
		),
		isMainnet: true,
	}

	response, err := adapter.GetPositions(
		httptest.NewRequest(http.MethodGet, "/api/v1/perp/positions?instrument=ETH-PERP", nil),
		perpPositionsQuery{
			AccountID:  "0xabc123",
			Venue:      venueHyperliquid,
			Instrument: "ETH-PERP",
		},
	)
	if err != nil {
		t.Fatalf("expected positions request to succeed, got err=%v", err)
	}

	if len(response.Positions) != 1 {
		t.Fatalf("expected one filtered position, got %d", len(response.Positions))
	}
	if !strings.EqualFold(response.Positions[0].Instrument, "ETH-PERP") {
		t.Fatalf("expected ETH-PERP, got %s", response.Positions[0].Instrument)
	}
}
