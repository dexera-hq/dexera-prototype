package http

import "testing"

func TestNormalizeHyperliquidWireDecimal(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name      string
		input     string
		want      string
		shouldErr bool
	}{
		{name: "trailing zeros", input: "0.10", want: "0.1"},
		{name: "leading and trailing zeros", input: "001.2300", want: "1.23"},
		{name: "fraction without integer", input: ".500", want: "0.5"},
		{name: "integer with decimal point", input: "42.", want: "42"},
		{name: "negative zero", input: "-0.000", want: "0"},
		{name: "integer", input: "15", want: "15"},
		{name: "scientific notation rejected", input: "1e-1", shouldErr: true},
		{name: "non numeric rejected", input: "abc", shouldErr: true},
		{name: "empty rejected", input: " ", shouldErr: true},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			got, err := normalizeHyperliquidWireDecimal(testCase.input)
			if testCase.shouldErr {
				if err == nil {
					t.Fatalf("expected error for input %q, got normalized value %q", testCase.input, got)
				}
				return
			}

			if err != nil {
				t.Fatalf("expected no error for input %q, got %v", testCase.input, err)
			}
			if got != testCase.want {
				t.Fatalf("expected normalized value %q, got %q", testCase.want, got)
			}
		})
	}
}

func TestHyperliquidConnectionIDDiffersForNonCanonicalSizeStrings(t *testing.T) {
	t.Parallel()

	actionWithTrailingZero := map[string]any{
		"type": "order",
		"orders": []any{
			map[string]any{
				"a": 3,
				"b": true,
				"p": "1168450.25",
				"s": "0.10",
				"r": false,
				"t": map[string]any{
					"limit": map[string]any{
						"tif": "Gtc",
					},
				},
			},
		},
		"grouping": "na",
	}
	actionCanonical := map[string]any{
		"type": "order",
		"orders": []any{
			map[string]any{
				"a": 3,
				"b": true,
				"p": "1168450.25",
				"s": "0.1",
				"r": false,
				"t": map[string]any{
					"limit": map[string]any{
						"tif": "Gtc",
					},
				},
			},
		},
		"grouping": "na",
	}

	hashWithTrailingZero, err := hyperliquidConnectionID(actionWithTrailingZero, 1772672352435)
	if err != nil {
		t.Fatalf("expected connection id for non-canonical action, got error: %v", err)
	}

	hashCanonical, err := hyperliquidConnectionID(actionCanonical, 1772672352435)
	if err != nil {
		t.Fatalf("expected connection id for canonical action, got error: %v", err)
	}

	if hashWithTrailingZero == hashCanonical {
		t.Fatalf("expected different connection ids, got identical hash %s", hashCanonical)
	}
}
