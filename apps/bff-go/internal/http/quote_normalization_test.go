package http

import "testing"

func TestFindStringByKeyPrefersDirectMatch(t *testing.T) {
	payload := map[string]any{
		"route": map[string]any{
			"spender": "0xnested",
		},
		"spender": "0xroot",
	}

	for i := 0; i < 200; i++ {
		if got := findStringByKey(payload, "spender"); got != "0xroot" {
			t.Fatalf("expected direct match spender, got %q", got)
		}
	}
}

func TestFindStringByKeyUsesDeterministicMapTraversal(t *testing.T) {
	payload := map[string]any{
		"zPath": map[string]any{
			"spender": "0xzzz",
		},
		"aPath": map[string]any{
			"spender": "0xaaa",
		},
	}

	for i := 0; i < 200; i++ {
		if got := findStringByKey(payload, "spender"); got != "0xaaa" {
			t.Fatalf("expected deterministic nested spender, got %q", got)
		}
	}
}
