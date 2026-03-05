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
