package http

import "testing"

const universalRouterCalldataWithDeadlineForTest = "0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000067748580"

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

func TestNormalizeQuoteResponseMapsUnsignedTxAliases(t *testing.T) {
	req := quoteRequest{
		ChainID:    8453,
		SellToken:  "0x1111111111111111111111111111111111111111",
		BuyToken:   "0x2222222222222222222222222222222222222222",
		SellAmount: "1000000000000000000",
	}
	quotePayload := map[string]any{
		"requestId": "quote_uni_001",
		"quote": map[string]any{
			"output": map[string]any{
				"amount": "1234500000000000000",
				"token":  "0x2222222222222222222222222222222222222222",
			},
			"aggregatedOutputs": []any{
				map[string]any{
					"minAmount": "1220000000000000000",
				},
			},
		},
	}
	swapPayload := map[string]any{
		"swap": map[string]any{
			"target":               "0x5555555555555555555555555555555555555555",
			"calldata":             universalRouterCalldataWithDeadlineForTest,
			"value":                "0",
			"gas":                  "250000",
			"maxFeePerGas":         "35000000000",
			"maxPriorityFeePerGas": "2000000000",
		},
	}

	normalized, err := normalizeQuoteResponse(req, quotePayload, swapPayload, nil)
	if err != nil {
		t.Fatalf("expected normalization success, got %v", err)
	}
	if normalized.UnsignedTx.To != "0x5555555555555555555555555555555555555555" {
		t.Fatalf("expected alias mapping for tx target, got %q", normalized.UnsignedTx.To)
	}
	if normalized.UnsignedTx.Data != universalRouterCalldataWithDeadlineForTest {
		t.Fatalf("expected alias mapping for tx calldata, got %q", normalized.UnsignedTx.Data)
	}
	if normalized.UnsignedTx.GasLimit != "250000" {
		t.Fatalf("expected alias mapping for tx gas, got %q", normalized.UnsignedTx.GasLimit)
	}
	if normalized.UnsignedTx.ChainID != 8453 {
		t.Fatalf("expected chainId from request, got %d", normalized.UnsignedTx.ChainID)
	}
	if normalized.MinOut != "1220000000000000000" {
		t.Fatalf("expected minOut from aggregatedOutputs, got %q", normalized.MinOut)
	}
	if normalized.Safety.Deadline != "1735689600" {
		t.Fatalf("expected deadline decoded from universal router calldata, got %q", normalized.Safety.Deadline)
	}
}

func TestNormalizeQuoteResponseFallsBackWhenSwapIsNonTransactional(t *testing.T) {
	req := quoteRequest{
		ChainID:    8453,
		SellToken:  "0x1111111111111111111111111111111111111111",
		BuyToken:   "0x2222222222222222222222222222222222222222",
		SellAmount: "1000000000000000000",
	}
	quotePayload := map[string]any{
		"requestId": "quote_uni_002",
		"quote": map[string]any{
			"output": map[string]any{
				"amount": "1234500000000000000",
			},
		},
		"minOut":   "1220000000000000000",
		"deadline": "1735689600",
	}
	swapPayload := map[string]any{
		"swap": map[string]any{
			"routeType": "exactInput",
		},
		"tx": map[string]any{
			"to":                   "0x5555555555555555555555555555555555555555",
			"data":                 "0xabcdef",
			"value":                "0",
			"gasLimit":             "250000",
			"maxFeePerGas":         "35000000000",
			"maxPriorityFeePerGas": "2000000000",
		},
	}

	normalized, err := normalizeQuoteResponse(req, quotePayload, swapPayload, nil)
	if err != nil {
		t.Fatalf("expected normalization success, got %v", err)
	}
	if normalized.UnsignedTx.To != "0x5555555555555555555555555555555555555555" {
		t.Fatalf("expected fallback to tx alias, got %q", normalized.UnsignedTx.To)
	}
	if normalized.UnsignedTx.Data != "0xabcdef" {
		t.Fatalf("expected fallback tx data, got %q", normalized.UnsignedTx.Data)
	}
}

func TestNormalizeQuoteResponseRejectsNonNumericDeadline(t *testing.T) {
	req := quoteRequest{
		ChainID:    1,
		SellToken:  "0x1111111111111111111111111111111111111111",
		BuyToken:   "0x2222222222222222222222222222222222222222",
		SellAmount: "1000000000000000000",
	}
	quotePayload := map[string]any{
		"requestId": "quote_uni_001",
		"quote": map[string]any{
			"output": map[string]any{
				"amount":    "1234500000000000000",
				"minAmount": "1220000000000000000",
			},
		},
		"deadline": "not-a-number",
	}
	swapPayload := map[string]any{
		"swap": map[string]any{
			"to":                   "0x5555555555555555555555555555555555555555",
			"data":                 "0xabcdef",
			"value":                "0",
			"gasLimit":             "250000",
			"maxFeePerGas":         "35000000000",
			"maxPriorityFeePerGas": "2000000000",
		},
	}

	if _, err := normalizeQuoteResponse(req, quotePayload, swapPayload, nil); err == nil {
		t.Fatalf("expected normalization error for non-numeric deadline")
	}
}
