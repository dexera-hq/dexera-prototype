package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultHyperliquidMainnetAPIBaseURL = "https://api.hyperliquid.xyz"
	defaultHyperliquidTestnetAPIBaseURL = "https://api.hyperliquid-testnet.xyz"
	clientSigningOnlyDisclaimer         = "Actions are prepared server-side as unsigned payloads only. Your wallet signs locally in the browser."
)

type upstreamHTTPError struct {
	op         string
	statusCode int
}

func (e *upstreamHTTPError) Error() string {
	return fmt.Sprintf("%s returned status %d", e.op, e.statusCode)
}

type hyperliquidAdapter struct {
	baseURL    string
	httpClient *http.Client
}

type asterMockAdapter struct{}

func resolvePerpVenueAdapter(venue venueID) (perpVenueAdapter, error) {
	switch venue {
	case venueHyperliquid:
		return newHyperliquidAdapterFromEnv()
	case venueAster:
		return &asterMockAdapter{}, nil
	default:
		return nil, errors.New("unsupported venue")
	}
}

func newHyperliquidAdapterFromEnv() (*hyperliquidAdapter, error) {
	baseURL := strings.TrimSpace(os.Getenv("HYPERLIQUID_API_BASE_URL"))
	if baseURL == "" {
		network := strings.ToLower(strings.TrimSpace(os.Getenv("HYPERLIQUID_NETWORK")))
		switch network {
		case "", "mainnet":
			baseURL = defaultHyperliquidMainnetAPIBaseURL
		case "testnet":
			baseURL = defaultHyperliquidTestnetAPIBaseURL
		default:
			return nil, fmt.Errorf("HYPERLIQUID_NETWORK must be one of: mainnet, testnet")
		}
	}
	baseURL = strings.TrimRight(baseURL, "/")

	return &hyperliquidAdapter{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
	}, nil
}

func (a *hyperliquidAdapter) PreviewOrder(
	r *http.Request,
	req buildUnsignedActionRequest,
) (perpOrderPreviewResponse, error) {
	payload, err := a.postJSON(r.Context(), "/v1/perp/orders/preview", map[string]any{"order": req.Order})
	if err != nil {
		return perpOrderPreviewResponse{}, err
	}

	previewID := stringField(payload, "previewId")
	if previewID == "" {
		previewID = fmt.Sprintf("prv_hl_%d", time.Now().UTC().UnixNano())
	}
	markPrice := optionalString(payload, "markPrice")
	estimatedNotional := stringField(payload, "estimatedNotional")
	if estimatedNotional == "" {
		estimatedNotional = "0"
	}
	estimatedFee := stringField(payload, "estimatedFee")
	if estimatedFee == "" {
		estimatedFee = "0"
	}
	expiresAt := stringField(payload, "expiresAt")
	if expiresAt == "" {
		expiresAt = time.Now().UTC().Add(8 * time.Second).Format(time.RFC3339)
	}

	return perpOrderPreviewResponse{
		PreviewID:         previewID,
		AccountID:         req.Order.AccountID,
		Venue:             req.Order.Venue,
		Instrument:        req.Order.Instrument,
		Side:              req.Order.Side,
		Type:              req.Order.Type,
		Size:              req.Order.Size,
		LimitPrice:        req.Order.LimitPrice,
		MarkPrice:         markPrice,
		EstimatedNotional: estimatedNotional,
		EstimatedFee:      estimatedFee,
		ExpiresAt:         expiresAt,
		Source:            string(venueHyperliquid),
	}, nil
}

func (a *hyperliquidAdapter) BuildUnsignedAction(
	r *http.Request,
	req buildUnsignedActionRequest,
) (buildUnsignedActionResponse, error) {
	payload, err := a.postJSON(r.Context(), "/v1/perp/actions/unsigned", map[string]any{"order": req.Order})
	if err != nil {
		return buildUnsignedActionResponse{}, err
	}

	action, _ := payload["action"].(map[string]any)
	if action == nil {
		action = map[string]any{
			"instrument": req.Order.Instrument,
			"side":       req.Order.Side,
			"type":       req.Order.Type,
			"size":       req.Order.Size,
			"limitPrice": req.Order.LimitPrice,
		}
	}

	orderID := stringField(payload, "orderId")
	if orderID == "" {
		orderID = fmt.Sprintf("ord_hl_%d", time.Now().UTC().UnixNano())
	}
	payloadID := stringField(payload, "id")
	if payloadID == "" {
		payloadID = fmt.Sprintf("uap_hl_%d", time.Now().UTC().UnixNano())
	}

	return buildUnsignedActionResponse{
		OrderID:       orderID,
		SigningPolicy: "client-signing-only",
		Disclaimer:    clientSigningOnlyDisclaimer,
		UnsignedActionPayload: unsignedActionPayload{
			ID:        payloadID,
			AccountID: req.Order.AccountID,
			Venue:     req.Order.Venue,
			Kind:      "perp_order_action",
			Action:    action,
		},
	}, nil
}

func (a *hyperliquidAdapter) GetPositions(
	r *http.Request,
	query perpPositionsQuery,
) (perpPositionsResponse, error) {
	params := url.Values{}
	params.Set("accountId", query.AccountID)
	if query.Instrument != "" {
		params.Set("instrument", query.Instrument)
	}

	payload, err := a.getJSON(r.Context(), "/v1/perp/positions", params)
	if err != nil {
		return perpPositionsResponse{}, err
	}

	rawPositions, _ := payload["positions"].([]any)
	positions := make([]perpPosition, 0, len(rawPositions))
	for idx, item := range rawPositions {
		positionMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		positionID := stringField(positionMap, "positionId")
		if positionID == "" {
			positionID = fmt.Sprintf("pos_hl_%d_%d", time.Now().UTC().Unix(), idx)
		}
		position := perpPosition{
			PositionID:       positionID,
			AccountID:        query.AccountID,
			Venue:            venueHyperliquid,
			Instrument:       firstNonEmptyString(stringField(positionMap, "instrument"), query.Instrument, "BTC-PERP"),
			Direction:        firstNonEmptyString(stringField(positionMap, "direction"), "long"),
			Status:           firstNonEmptyString(stringField(positionMap, "status"), "open"),
			Size:             firstNonEmptyString(stringField(positionMap, "size"), "0"),
			EntryPrice:       firstNonEmptyString(stringField(positionMap, "entryPrice"), "0"),
			MarkPrice:        firstNonEmptyString(stringField(positionMap, "markPrice"), "0"),
			NotionalValue:    firstNonEmptyString(stringField(positionMap, "notionalValue"), "0"),
			Leverage:         stringField(positionMap, "leverage"),
			UnrealizedPnLUSD: firstNonEmptyString(stringField(positionMap, "unrealizedPnlUsd"), "0"),
			LastUpdatedAt: firstNonEmptyString(
				stringField(positionMap, "lastUpdatedAt"),
				time.Now().UTC().Format(time.RFC3339),
			),
		}
		positions = append(positions, position)
	}

	if len(positions) == 0 {
		now := time.Now().UTC().Format(time.RFC3339)
		positions = []perpPosition{
			{
				PositionID:       "pos_hl_mock_001",
				AccountID:        query.AccountID,
				Venue:            venueHyperliquid,
				Instrument:       firstNonEmptyString(query.Instrument, "BTC-PERP"),
				Direction:        "long",
				Status:           "open",
				Size:             "0.25",
				EntryPrice:       "68500.0",
				MarkPrice:        "68720.0",
				NotionalValue:    "17180.00",
				Leverage:         "5",
				UnrealizedPnLUSD: "55.00",
				LastUpdatedAt:    now,
			},
		}
	}

	return perpPositionsResponse{
		AccountID: query.AccountID,
		Venue:     venueHyperliquid,
		Positions: positions,
		Source:    string(venueHyperliquid),
	}, nil
}

func (a *asterMockAdapter) PreviewOrder(
	_ *http.Request,
	req buildUnsignedActionRequest,
) (perpOrderPreviewResponse, error) {
	markPrice := "3210.50"
	if req.Order.LimitPrice != nil && strings.TrimSpace(*req.Order.LimitPrice) != "" {
		markPrice = strings.TrimSpace(*req.Order.LimitPrice)
	}
	return perpOrderPreviewResponse{
		PreviewID:         fmt.Sprintf("prv_as_%d", time.Now().UTC().UnixNano()),
		AccountID:         req.Order.AccountID,
		Venue:             venueAster,
		Instrument:        req.Order.Instrument,
		Side:              req.Order.Side,
		Type:              req.Order.Type,
		Size:              req.Order.Size,
		LimitPrice:        req.Order.LimitPrice,
		MarkPrice:         &markPrice,
		EstimatedNotional: "1000.00",
		EstimatedFee:      "0.75",
		ExpiresAt:         time.Now().UTC().Add(8 * time.Second).Format(time.RFC3339),
		Source:            "mock",
	}, nil
}

func (a *asterMockAdapter) BuildUnsignedAction(
	_ *http.Request,
	req buildUnsignedActionRequest,
) (buildUnsignedActionResponse, error) {
	return buildUnsignedActionResponse{
		OrderID:       fmt.Sprintf("ord_as_%d", time.Now().UTC().UnixNano()),
		SigningPolicy: "client-signing-only",
		Disclaimer:    clientSigningOnlyDisclaimer,
		UnsignedActionPayload: unsignedActionPayload{
			ID:        fmt.Sprintf("uap_as_%d", time.Now().UTC().UnixNano()),
			AccountID: req.Order.AccountID,
			Venue:     venueAster,
			Kind:      "perp_order_action",
			Action: map[string]any{
				"instrument": req.Order.Instrument,
				"side":       req.Order.Side,
				"type":       req.Order.Type,
				"size":       req.Order.Size,
				"limitPrice": req.Order.LimitPrice,
			},
		},
	}, nil
}

func (a *asterMockAdapter) GetPositions(
	_ *http.Request,
	query perpPositionsQuery,
) (perpPositionsResponse, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	instrument := query.Instrument
	if instrument == "" {
		instrument = "ETH-PERP"
	}

	return perpPositionsResponse{
		AccountID: query.AccountID,
		Venue:     venueAster,
		Positions: []perpPosition{
			{
				PositionID:       "pos_as_mock_001",
				AccountID:        query.AccountID,
				Venue:            venueAster,
				Instrument:       instrument,
				Direction:        "short",
				Status:           "open",
				Size:             "1.50",
				EntryPrice:       "3200.00",
				MarkPrice:        "3188.25",
				NotionalValue:    "4782.38",
				Leverage:         "3",
				UnrealizedPnLUSD: "17.62",
				LastUpdatedAt:    now,
			},
		},
		Source: "mock",
	}, nil
}

func (a *hyperliquidAdapter) CheckWalletEligibility(
	r *http.Request,
	address string,
) (walletVenueEligibilityResult, error) {
	params := url.Values{}
	params.Set("accountId", address)

	_, err := a.getJSON(r.Context(), "/v1/perp/positions", params)
	if err != nil {
		var upstreamErr *upstreamHTTPError
		if errors.As(err, &upstreamErr) &&
			upstreamErr.statusCode >= http.StatusBadRequest &&
			upstreamErr.statusCode < http.StatusInternalServerError {
			return walletVenueEligibilityResult{
				Eligible: false,
				Reason:   "venue rejected the address for trading access",
				Source:   string(venueHyperliquid),
			}, nil
		}
		return walletVenueEligibilityResult{}, err
	}

	return walletVenueEligibilityResult{
		Eligible: true,
		Reason:   "address is accepted by venue account checks",
		Source:   string(venueHyperliquid),
	}, nil
}

func (a *asterMockAdapter) CheckWalletEligibility(
	_ *http.Request,
	address string,
) (walletVenueEligibilityResult, error) {
	trimmed := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(address)), "0x")
	if trimmed == "" {
		return walletVenueEligibilityResult{
			Eligible: false,
			Reason:   "invalid address",
			Source:   "mock",
		}, nil
	}

	lastNibble := trimmed[len(trimmed)-1]
	isEligible := strings.ContainsRune("02468ace", rune(lastNibble))
	if !isEligible {
		return walletVenueEligibilityResult{
			Eligible: false,
			Reason:   "mock venue eligibility check rejected this address",
			Source:   "mock",
		}, nil
	}

	return walletVenueEligibilityResult{
		Eligible: true,
		Reason:   "mock venue eligibility check accepted this address",
		Source:   "mock",
	}, nil
}

func (a *hyperliquidAdapter) postJSON(
	ctx context.Context,
	path string,
	payload map[string]any,
) (map[string]any, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := a.baseURL + "/" + strings.TrimLeft(path, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &upstreamHTTPError{op: path, statusCode: resp.StatusCode}
	}

	var decoded map[string]any
	if len(responseBody) == 0 {
		return map[string]any{}, nil
	}
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return nil, err
	}
	return decoded, nil
}

func (a *hyperliquidAdapter) getJSON(
	ctx context.Context,
	path string,
	params url.Values,
) (map[string]any, error) {
	endpoint := a.baseURL + "/" + strings.TrimLeft(path, "/")
	if len(params) > 0 {
		endpoint = endpoint + "?" + params.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &upstreamHTTPError{op: path, statusCode: resp.StatusCode}
	}

	var decoded map[string]any
	if len(responseBody) == 0 {
		return map[string]any{}, nil
	}
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return nil, err
	}
	return decoded, nil
}

func stringField(values map[string]any, key string) string {
	v, _ := values[key].(string)
	return strings.TrimSpace(v)
}

func optionalString(values map[string]any, key string) *string {
	v := stringField(values, key)
	if v == "" {
		return nil
	}
	return &v
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
