package http

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func normalizeQuoteResponse(
	req quoteRequest,
	quotePayload map[string]any,
	approvalPayload map[string]any,
) (quoteResponse, error) {
	quoteID := firstNonEmpty(
		findStringDeep(quotePayload, "quoteId", "requestId", "id"),
	)
	if quoteID == "" {
		quoteID = fmt.Sprintf("quote_uniswap_%d", time.Now().UTC().UnixNano())
	}

	amountOut := firstNonEmpty(
		stringAtPath(quotePayload, "amountOut"),
		stringAtPath(quotePayload, "outputAmount"),
		stringAtPath(quotePayload, "quote", "output", "amount"),
		stringAtPath(quotePayload, "output", "amount"),
	)
	if amountOut == "" {
		return quoteResponse{}, fmt.Errorf("missing amountOut in provider payload")
	}

	minOut := firstNonEmpty(
		stringAtPath(quotePayload, "minOut"),
		stringAtPath(quotePayload, "minAmountOut"),
		stringAtPath(quotePayload, "quote", "output", "minAmount"),
		stringAtPath(quotePayload, "output", "minAmount"),
		amountOut,
	)

	return quoteResponse{
		QuoteID:           quoteID,
		ChainID:           req.ChainID,
		SellToken:         req.SellToken,
		BuyToken:          req.BuyToken,
		SellAmount:        req.SellAmount,
		AmountOut:         amountOut,
		MinOut:            minOut,
		Route:             normalizeQuoteRoute(quotePayload),
		Fees:              normalizeQuoteFees(quotePayload),
		RequiredApprovals: normalizeRequiredApprovals(req, quotePayload, approvalPayload),
		Source:            "uniswap",
	}, nil
}

func normalizeQuoteRoute(quotePayload map[string]any) []quoteRouteHop {
	routeRaw := firstAny(
		anyAtPath(quotePayload, "route"),
		anyAtPath(quotePayload, "quote", "route"),
		anyAtPath(quotePayload, "routing"),
		anyAtPath(quotePayload, "quote", "routing"),
	)
	if routeRaw == nil {
		return []quoteRouteHop{}
	}

	paths, ok := routeRaw.([]any)
	if !ok {
		if routeMap, ok := routeRaw.(map[string]any); ok {
			paths = []any{routeMap}
		} else {
			return []quoteRouteHop{}
		}
	}

	hops := make([]quoteRouteHop, 0)
	for pathIdx, pathValue := range paths {
		switch typedPath := pathValue.(type) {
		case []any:
			for hopIdx, hopValue := range typedPath {
				hopMap, ok := hopValue.(map[string]any)
				if !ok {
					continue
				}
				hops = append(hops, normalizeRouteHop(pathIdx, hopIdx, hopMap))
			}
		case map[string]any:
			hops = append(hops, normalizeRouteHop(pathIdx, 0, typedPath))
		}
	}

	return hops
}

func normalizeRouteHop(pathIdx int, hopIdx int, hop map[string]any) quoteRouteHop {
	return quoteRouteHop{
		PathIndex: pathIdx,
		HopIndex:  hopIdx,
		Type:      firstNonEmpty(stringFromMap(hop, "type", "protocol", "name"), "unknown"),
		Address: firstNonEmpty(
			stringFromMap(hop, "address", "poolAddress", "id"),
			addressFromAny(hop["pool"]),
		),
		TokenIn: firstNonEmpty(
			addressFromAny(hop["tokenIn"]),
			addressFromAny(hop["inputToken"]),
		),
		TokenOut: firstNonEmpty(
			addressFromAny(hop["tokenOut"]),
			addressFromAny(hop["outputToken"]),
		),
	}
}

func normalizeQuoteFees(quotePayload map[string]any) quoteFees {
	fees := quoteFees{
		GasFee: firstNonEmpty(
			stringAtPath(quotePayload, "gasFee"),
			stringAtPath(quotePayload, "quote", "gasFee"),
		),
		GasFeeQuote: firstNonEmpty(
			stringAtPath(quotePayload, "gasFeeQuote"),
			stringAtPath(quotePayload, "quote", "gasFeeQuote"),
		),
		GasFeeUSD: firstNonEmpty(
			stringAtPath(quotePayload, "gasFeeUSD"),
			stringAtPath(quotePayload, "gasFeeUsd"),
			stringAtPath(quotePayload, "quote", "gasFeeUSD"),
			stringAtPath(quotePayload, "quote", "gasFeeUsd"),
		),
		Items: []quoteFeeItem{},
	}

	feesRaw := firstAny(
		anyAtPath(quotePayload, "fees"),
		anyAtPath(quotePayload, "quote", "fees"),
		anyAtPath(quotePayload, "quote", "output", "fees"),
		anyAtPath(quotePayload, "output", "fees"),
	)

	feeList, ok := feesRaw.([]any)
	if !ok {
		return fees
	}

	for _, feeValue := range feeList {
		feeMap, ok := feeValue.(map[string]any)
		if !ok {
			continue
		}
		fees.Items = append(fees.Items, quoteFeeItem{
			Type:      stringFromMap(feeMap, "type", "name"),
			Amount:    stringFromMap(feeMap, "amount"),
			Token:     firstNonEmpty(stringFromMap(feeMap, "token"), addressFromNestedMap(feeMap, "token")),
			Bips:      stringFromMap(feeMap, "bips", "basisPoints"),
			Recipient: stringFromMap(feeMap, "recipient", "to"),
		})
	}

	return fees
}

func normalizeRequiredApprovals(
	req quoteRequest,
	quotePayload map[string]any,
	approvalPayload map[string]any,
) []requiredApproval {
	if approvalPayload == nil {
		return []requiredApproval{}
	}

	approvalsRaw, approvalsExist := approvalPayload["approvals"]
	if approvalsExist {
		approvalList, ok := approvalsRaw.([]any)
		if ok {
			out := make([]requiredApproval, 0, len(approvalList))
			for _, approvalValue := range approvalList {
				approvalMap, ok := approvalValue.(map[string]any)
				if !ok {
					continue
				}
				normalized, ok := normalizeRequiredApprovalEntry(req, quotePayload, approvalPayload, approvalMap)
				if ok {
					out = append(out, normalized)
				}
			}
			return out
		}
	}

	approvalMap := map[string]any{
		"token":    approvalPayload["token"],
		"spender":  approvalPayload["spender"],
		"approval": approvalPayload["approval"],
		"cancel":   approvalPayload["cancel"],
	}
	normalized, ok := normalizeRequiredApprovalEntry(req, quotePayload, approvalPayload, approvalMap)
	if !ok {
		return []requiredApproval{}
	}

	return []requiredApproval{normalized}
}

func normalizeRequiredApprovalEntry(
	req quoteRequest,
	quotePayload map[string]any,
	approvalPayload map[string]any,
	entry map[string]any,
) (requiredApproval, bool) {
	approvalTxPayload := firstAny(entry["approval"], entry["approvalTx"], entry["tx"])
	approvalTxValue, ok := normalizeApprovalTx(approvalTxPayload)
	if !ok {
		return requiredApproval{}, false
	}

	cancelTxPayload := firstAny(entry["cancel"], entry["cancelTx"])
	cancelTxValue, hasCancel := normalizeApprovalTx(cancelTxPayload)

	normalized := requiredApproval{
		Token: firstNonEmpty(
			stringFromMap(entry, "token", "tokenAddress"),
			req.SellToken,
		),
		Spender: firstNonEmpty(
			stringFromMap(entry, "spender"),
			findStringDeep(approvalPayload, "spender"),
			findStringDeep(quotePayload, "permit2Address", "spender"),
		),
		RequiredAmount: firstNonEmpty(
			stringFromMap(entry, "requiredAmount", "amount"),
			req.SellAmount,
		),
		ApprovalTx: approvalTxValue,
	}
	if hasCancel {
		normalized.CancelTx = &cancelTxValue
	}

	return normalized, true
}

func normalizeApprovalTx(value any) (approvalTx, bool) {
	payload, ok := value.(map[string]any)
	if !ok {
		return approvalTx{}, false
	}

	to := firstNonEmpty(stringFromMap(payload, "to", "target"))
	data := firstNonEmpty(stringFromMap(payload, "data", "calldata"))
	if to == "" || data == "" {
		return approvalTx{}, false
	}

	return approvalTx{
		To:                   to,
		From:                 stringFromMap(payload, "from"),
		Data:                 data,
		Value:                firstNonEmpty(stringFromMap(payload, "value"), "0"),
		GasLimit:             stringFromMap(payload, "gasLimit"),
		MaxFeePerGas:         stringFromMap(payload, "maxFeePerGas"),
		MaxPriorityFeePerGas: stringFromMap(payload, "maxPriorityFeePerGas"),
	}, true
}

func stringAtPath(root map[string]any, path ...string) string {
	return stringifyScalar(anyAtPath(root, path...))
}

func anyAtPath(root map[string]any, path ...string) any {
	var current any = root
	for _, key := range path {
		currentMap, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		next, ok := currentMap[key]
		if !ok {
			return nil
		}
		current = next
	}
	return current
}

func stringFromMap(root map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := root[key]; ok {
			if asString := stringifyScalar(value); asString != "" {
				return asString
			}
		}
	}
	return ""
}

func addressFromNestedMap(root map[string]any, key string) string {
	nestedRaw, ok := root[key]
	if !ok {
		return ""
	}
	return addressFromAny(nestedRaw)
}

func addressFromAny(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		return firstNonEmpty(
			stringFromMap(typed, "address", "tokenAddress", "id", "symbol"),
			addressFromAny(typed["token"]),
		)
	case []any:
		for _, item := range typed {
			if resolved := addressFromAny(item); resolved != "" {
				return resolved
			}
		}
		return ""
	default:
		return stringifyScalar(typed)
	}
}

func findStringDeep(root any, keys ...string) string {
	for _, key := range keys {
		if value := findStringByKey(root, key); value != "" {
			return value
		}
	}
	return ""
}

func findStringByKey(root any, key string) string {
	switch typed := root.(type) {
	case map[string]any:
		for mapKey, mapValue := range typed {
			if mapKey == key {
				if asString := stringifyScalar(mapValue); asString != "" {
					return asString
				}
			}
			if nested := findStringByKey(mapValue, key); nested != "" {
				return nested
			}
		}
	case []any:
		for _, listValue := range typed {
			if nested := findStringByKey(listValue, key); nested != "" {
				return nested
			}
		}
	}
	return ""
}

func stringifyScalar(value any) string {
	switch value.(type) {
	case map[string]any, []any:
		return ""
	default:
		return stringify(value)
	}
}

func stringify(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(typed)
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(typed), 'f', -1, 32)
	case int:
		return strconv.Itoa(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	case int32:
		return strconv.FormatInt(int64(typed), 10)
	case uint:
		return strconv.FormatUint(uint64(typed), 10)
	case uint64:
		return strconv.FormatUint(typed, 10)
	case uint32:
		return strconv.FormatUint(uint64(typed), 10)
	case bool:
		return strconv.FormatBool(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(value))
	}
}

func firstAny(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
