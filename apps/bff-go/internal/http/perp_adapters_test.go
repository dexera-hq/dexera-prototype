package http

import "testing"

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
