package http

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	hyperliquid "github.com/sonirico/go-hyperliquid"
	"github.com/vmihailenco/msgpack/v5"
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
	infoClient *hyperliquid.Info
	isMainnet  bool
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
	isMainnet := isHyperliquidMainnetURL(baseURL)
	if network := strings.ToLower(strings.TrimSpace(os.Getenv("HYPERLIQUID_NETWORK"))); network == "testnet" {
		isMainnet = false
	}

	metaSeed := &hyperliquid.Meta{}
	spotMetaSeed := &hyperliquid.SpotMeta{}
	infoClient := hyperliquid.NewInfo(
		context.Background(),
		baseURL,
		true,
		metaSeed,
		spotMetaSeed,
		nil,
	)

	return &hyperliquidAdapter{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		infoClient: infoClient,
		isMainnet:  isMainnet,
	}, nil
}

func (a *hyperliquidAdapter) PreviewOrder(
	r *http.Request,
	req buildUnsignedActionRequest,
) (perpOrderPreviewResponse, error) {
	coin := normalizePerpCoinFromInstrument(req.Order.Instrument)
	if coin == "" {
		return perpOrderPreviewResponse{}, errors.New("instrument is required")
	}

	mids, err := a.infoClient.AllMids(r.Context())
	if err != nil {
		return perpOrderPreviewResponse{}, err
	}

	markPriceValue := strings.TrimSpace(mids[coin])
	if markPriceValue == "" {
		return perpOrderPreviewResponse{}, fmt.Errorf("failed to resolve mark price for %s", coin)
	}

	markPrice, err := strconv.ParseFloat(markPriceValue, 64)
	if err != nil {
		return perpOrderPreviewResponse{}, fmt.Errorf("failed to parse mark price for %s", coin)
	}

	size, err := strconv.ParseFloat(strings.TrimSpace(req.Order.Size), 64)
	if err != nil {
		return perpOrderPreviewResponse{}, errors.New("size must be a valid number")
	}

	priceForNotional := markPrice
	if req.Order.LimitPrice != nil && strings.TrimSpace(*req.Order.LimitPrice) != "" {
		limitPrice, parseErr := strconv.ParseFloat(strings.TrimSpace(*req.Order.LimitPrice), 64)
		if parseErr == nil && limitPrice > 0 {
			priceForNotional = limitPrice
		}
	}

	estimatedNotional := fmt.Sprintf("%.2f", size*priceForNotional)
	estimatedFee := fmt.Sprintf("%.2f", size*priceForNotional*0.00045)

	return perpOrderPreviewResponse{
		PreviewID:         fmt.Sprintf("prv_hl_%d", time.Now().UTC().UnixNano()),
		AccountID:         req.Order.AccountID,
		Venue:             req.Order.Venue,
		Instrument:        req.Order.Instrument,
		Side:              req.Order.Side,
		Type:              req.Order.Type,
		Size:              req.Order.Size,
		LimitPrice:        req.Order.LimitPrice,
		MarkPrice:         &markPriceValue,
		EstimatedNotional: estimatedNotional,
		EstimatedFee:      estimatedFee,
		ExpiresAt:         time.Now().UTC().Add(8 * time.Second).Format(time.RFC3339),
		Source:            string(venueHyperliquid),
	}, nil
}

func (a *hyperliquidAdapter) BuildUnsignedAction(
	r *http.Request,
	req buildUnsignedActionRequest,
) (buildUnsignedActionResponse, error) {
	coin := normalizePerpCoinFromInstrument(req.Order.Instrument)
	if coin == "" {
		return buildUnsignedActionResponse{}, errors.New("instrument is required")
	}

	metaPayload, err := a.infoClient.Meta(r.Context())
	if err != nil {
		return buildUnsignedActionResponse{}, err
	}
	asset, err := resolvePerpAssetFromSDK(metaPayload, coin)
	if err != nil {
		return buildUnsignedActionResponse{}, err
	}
	szDecimals := 0
	if asset >= 0 && asset < len(metaPayload.Universe) {
		szDecimals = metaPayload.Universe[asset].SzDecimals
	}

	isBuy := strings.EqualFold(strings.TrimSpace(req.Order.Side), "buy")
	reduceOnly := req.Order.ReduceOnly != nil && *req.Order.ReduceOnly

	sizeWire, err := normalizeHyperliquidWireDecimal(req.Order.Size)
	if err != nil {
		return buildUnsignedActionResponse{}, errors.New("size must be a plain decimal number")
	}

	price := ""
	tif := "Gtc"
	switch strings.ToLower(strings.TrimSpace(req.Order.Type)) {
	case "limit":
		if req.Order.LimitPrice == nil || strings.TrimSpace(*req.Order.LimitPrice) == "" {
			return buildUnsignedActionResponse{}, errors.New("limit orders require limitPrice")
		}
		limitPrice, parseErr := strconv.ParseFloat(strings.TrimSpace(*req.Order.LimitPrice), 64)
		if parseErr != nil {
			return buildUnsignedActionResponse{}, errors.New("limitPrice must be a plain decimal number")
		}
		price, err = normalizeHyperliquidPerpPriceWire(limitPrice, szDecimals)
		if err != nil {
			return buildUnsignedActionResponse{}, errors.New("limitPrice must be a valid Hyperliquid price")
		}
	case "market":
		midPayload, midErr := a.infoClient.AllMids(r.Context())
		if midErr != nil {
			return buildUnsignedActionResponse{}, midErr
		}
		midString := strings.TrimSpace(midPayload[coin])
		if midString == "" {
			return buildUnsignedActionResponse{}, fmt.Errorf("failed to resolve mark price for %s", coin)
		}

		mid, parseErr := strconv.ParseFloat(midString, 64)
		if parseErr != nil {
			return buildUnsignedActionResponse{}, fmt.Errorf("failed to parse mark price for %s", coin)
		}
		slippageMultiplier := 1.05
		if !isBuy {
			slippageMultiplier = 0.95
		}
		price, err = normalizeHyperliquidPerpPriceWire(mid*slippageMultiplier, szDecimals)
		if err != nil {
			return buildUnsignedActionResponse{}, fmt.Errorf("failed to normalize mark price for %s", coin)
		}
		tif = "Ioc"
	default:
		return buildUnsignedActionResponse{}, errors.New("type must be market or limit")
	}

	orderWireType := hyperliquid.OrderWireType{
		Limit: &hyperliquid.OrderWireTypeLimit{
			Tif: hyperliquid.Tif(tif),
		},
	}
	orderWireCanonical := hyperliquid.OrderWire{
		Asset:      asset,
		IsBuy:      isBuy,
		LimitPx:    price,
		Size:       sizeWire,
		ReduceOnly: reduceOnly,
		OrderType:  orderWireType,
	}
	if clientOrderID := strings.TrimSpace(req.Order.ClientOrderID); clientOrderID != "" {
		orderWireCanonical.Cloid = &clientOrderID
	}
	actionCanonical := hyperliquid.OrderAction{
		Type:     "order",
		Orders:   []hyperliquid.OrderWire{orderWireCanonical},
		Grouping: string(hyperliquid.GroupingNA),
	}
	action, err := marshalActionToMap(actionCanonical)
	if err != nil {
		return buildUnsignedActionResponse{}, err
	}
	nonce := time.Now().UTC().UnixMilli()
	unsignedExchangeRequest := map[string]any{
		"action": action,
		"nonce":  nonce,
	}
	typedDataJSON, _, err := buildHyperliquidSignTypedDataFromAction(
		actionCanonical,
		nonce,
		a.isMainnet,
	)
	if err != nil {
		return buildUnsignedActionResponse{}, err
	}
	orderID := strings.TrimSpace(req.Order.ClientOrderID)
	if orderID == "" {
		orderID = fmt.Sprintf("ord_hl_%d", time.Now().UTC().UnixNano())
	}
	payloadID := fmt.Sprintf("uap_hl_%d", time.Now().UTC().UnixNano())

	return buildUnsignedActionResponse{
		OrderID:       orderID,
		SigningPolicy: "client-signing-only",
		Disclaimer:    clientSigningOnlyDisclaimer,
		UnsignedActionPayload: unsignedActionPayload{
			ID:        payloadID,
			AccountID: req.Order.AccountID,
			Venue:     req.Order.Venue,
			Kind:      "perp_order_action",
			Action:    unsignedExchangeRequest,
			WalletRequest: walletRequestPayload{
				Method: "eth_signTypedData_v4",
				Params: []any{req.Order.AccountID, typedDataJSON},
			},
		},
	}, nil
}

func (a *hyperliquidAdapter) SubmitSignedAction(
	r *http.Request,
	req submitSignedActionRequest,
) (submitSignedActionResponse, error) {
	submitPayload := make(map[string]any, len(req.UnsignedActionPayload.Action)+1)
	for key, value := range req.UnsignedActionPayload.Action {
		submitPayload[key] = value
	}

	rawSignature, err := decodeWalletSignatureBytes(req.Signature)
	if err != nil {
		return submitSignedActionResponse{}, err
	}
	recoveredSigner, requestedSigner, err := recoverHyperliquidTypedDataSigner(
		req.Signature,
		req.UnsignedActionPayload.WalletRequest,
	)
	if err != nil {
		return submitSignedActionResponse{}, err
	}
	expectedAccountID := strings.TrimSpace(req.UnsignedActionPayload.AccountID)
	if requestedSigner != "" && !strings.EqualFold(requestedSigner, expectedAccountID) {
		return submitSignedActionResponse{}, fmt.Errorf(
			"wallet request signer %s does not match unsignedActionPayload.accountId %s",
			requestedSigner,
			expectedAccountID,
		)
	}
	if !strings.EqualFold(recoveredSigner, expectedAccountID) {
		return submitSignedActionResponse{}, fmt.Errorf(
			"signed action signature recovered signer %s does not match unsignedActionPayload.accountId %s",
			recoveredSigner,
			expectedAccountID,
		)
	}
	submitPayload["signature"] = buildHyperliquidWalletSignaturePayload(rawSignature, false)

	exchangeResponse, err := a.postJSON(r.Context(), "/exchange", submitPayload)
	if err != nil {
		return submitSignedActionResponse{}, err
	}
	primaryStatus := normalizeHyperliquidSubmissionStatus(exchangeResponse)
	if primaryStatus != "submitted" {
		if alternateVPayload, hasAlternate := buildAlternateHyperliquidWalletSignaturePayload(rawSignature); hasAlternate {
			submitPayload["signature"] = alternateVPayload
			alternateResponse, alternateErr := a.postJSON(r.Context(), "/exchange", submitPayload)
			if alternateErr == nil {
				alternateStatus := normalizeHyperliquidSubmissionStatus(alternateResponse)
				if alternateStatus == "submitted" {
					exchangeResponse = alternateResponse
				}
			}
		}
	}

	actionHash := extractConnectionIDFromWalletRequest(req.UnsignedActionPayload.WalletRequest)
	if strings.TrimSpace(actionHash) == "" {
		computedHash, hashErr := hyperliquidConnectionIDFromUnsignedAction(req.UnsignedActionPayload.Action)
		if hashErr == nil {
			actionHash = computedHash
		}
	}

	status := normalizeHyperliquidSubmissionStatus(exchangeResponse)
	debugReason := extractHyperliquidSubmissionDebugReason(exchangeResponse)
	venueOrderID := extractHyperliquidVenueOrderID(exchangeResponse)
	if strings.TrimSpace(actionHash) == "" {
		actionHash = fmt.Sprintf("hl_submit_%d", time.Now().UTC().UnixNano())
	}
	if debugReason != nil {
		log.Printf(
			`hyperliquid submit returned non-success status=%q reason=%q orderId=%q accountId=%q exchangeResponse=%s`,
			status,
			*debugReason,
			req.OrderID,
			req.UnsignedActionPayload.AccountID,
			marshalDebugJSON(exchangeResponse),
		)
	}

	return submitSignedActionResponse{
		OrderID:      req.OrderID,
		ActionHash:   actionHash,
		Venue:        venueHyperliquid,
		Status:       status,
		DebugReason:  debugReason,
		VenueOrderID: venueOrderID,
		Source:       string(venueHyperliquid),
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

func (a *hyperliquidAdapter) GetOrderStatus(
	r *http.Request,
	query perpOrderStatusQuery,
) (perpOrderStatusResponse, error) {
	trimmedVenueOrderID := strings.TrimSpace(query.VenueOrderID)
	if trimmedVenueOrderID == "" {
		return perpOrderStatusResponse{}, errors.New("venueOrderId is required")
	}

	var oid any = trimmedVenueOrderID
	if parsedOID, err := strconv.ParseUint(trimmedVenueOrderID, 10, 64); err == nil {
		oid = parsedOID
	}

	statusPayload, err := a.postJSON(r.Context(), "/info", map[string]any{
		"type": "orderStatus",
		"user": strings.TrimSpace(query.AccountID),
		"oid":  oid,
	})
	if err != nil {
		return perpOrderStatusResponse{}, err
	}

	venueStatus := extractHyperliquidOrderStatusValue(statusPayload)
	if venueStatus == "" {
		venueStatus = "unknown"
	}
	normalizedStatus := normalizeHyperliquidOrderStatus(venueStatus)

	return perpOrderStatusResponse{
		AccountID:     strings.TrimSpace(query.AccountID),
		Venue:         venueHyperliquid,
		OrderID:       strings.TrimSpace(query.OrderID),
		VenueOrderID:  trimmedVenueOrderID,
		Status:        normalizedStatus,
		VenueStatus:   venueStatus,
		IsTerminal:    isHyperliquidOrderStatusTerminal(normalizedStatus),
		LastUpdatedAt: time.Now().UTC().Format(time.RFC3339),
		Source:        string(venueHyperliquid),
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
	actionPayloadID := fmt.Sprintf("uap_as_%d", time.Now().UTC().UnixNano())
	action := map[string]any{
		"instrument": req.Order.Instrument,
		"side":       req.Order.Side,
		"type":       req.Order.Type,
		"size":       req.Order.Size,
		"limitPrice": req.Order.LimitPrice,
	}

	return buildUnsignedActionResponse{
		OrderID:       fmt.Sprintf("ord_as_%d", time.Now().UTC().UnixNano()),
		SigningPolicy: "client-signing-only",
		Disclaimer:    clientSigningOnlyDisclaimer,
		UnsignedActionPayload: unsignedActionPayload{
			ID:        actionPayloadID,
			AccountID: req.Order.AccountID,
			Venue:     venueAster,
			Kind:      "perp_order_action",
			Action:    action,
			WalletRequest: walletRequestPayload{
				Method: "wallet_perp_submitAction",
				Params: []any{
					map[string]any{
						"accountId": req.Order.AccountID,
						"payloadId": actionPayloadID,
						"venue":     venueAster,
						"action":    action,
					},
				},
			},
		},
	}, nil
}

func (a *asterMockAdapter) SubmitSignedAction(
	_ *http.Request,
	_ submitSignedActionRequest,
) (submitSignedActionResponse, error) {
	return submitSignedActionResponse{}, errSignedSubmitNotSupported
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

func (a *asterMockAdapter) GetOrderStatus(
	_ *http.Request,
	_ perpOrderStatusQuery,
) (perpOrderStatusResponse, error) {
	return perpOrderStatusResponse{}, errors.New("order status reconciliation is not supported for aster")
}

func (a *hyperliquidAdapter) CheckWalletEligibility(
	r *http.Request,
	address string,
) (walletVenueEligibilityResult, error) {
	rolePayload, err := a.postJSON(r.Context(), "/info", map[string]any{
		"type": "userRole",
		"user": address,
	})
	if err != nil {
		var upstreamErr *upstreamHTTPError
		if errors.As(err, &upstreamErr) &&
			upstreamErr.statusCode >= http.StatusBadRequest &&
			upstreamErr.statusCode < http.StatusInternalServerError {
			return walletVenueEligibilityResult{
				Eligible: false,
				Reason:   "venue rejected the address for role lookup",
				Source:   string(venueHyperliquid),
			}, nil
		}
		return walletVenueEligibilityResult{}, err
	}

	role := normalizeHyperliquidUserRole(rolePayload)
	switch role {
	case "user", "subaccount":
		// allowed account roles for this prototype eligibility flow
	case "missing":
		return walletVenueEligibilityResult{
			Eligible: false,
			Reason:   "wallet is not registered on Hyperliquid",
			Source:   string(venueHyperliquid),
		}, nil
	case "agent":
		return walletVenueEligibilityResult{
			Eligible: false,
			Reason:   "agent wallets are not eligible; use a master or subaccount address",
			Source:   string(venueHyperliquid),
		}, nil
	case "vault":
		return walletVenueEligibilityResult{
			Eligible: false,
			Reason:   "vault addresses are not eligible for direct wallet trading access",
			Source:   string(venueHyperliquid),
		}, nil
	case "":
		return walletVenueEligibilityResult{
			Eligible: false,
			Reason:   "venue did not return a wallet role",
			Source:   string(venueHyperliquid),
		}, nil
	default:
		return walletVenueEligibilityResult{
			Eligible: false,
			Reason:   fmt.Sprintf("wallet role %q is not eligible for this trading flow", role),
			Source:   string(venueHyperliquid),
		}, nil
	}

	_, err = a.postJSON(r.Context(), "/info", map[string]any{
		"type": "clearinghouseState",
		"user": address,
	})
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

func normalizeHyperliquidUserRole(payload map[string]any) string {
	role := stringField(payload, "role")
	if role == "" {
		role = stringField(payload, "userRole")
	}
	return strings.ToLower(strings.TrimSpace(role))
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

func normalizePerpCoinFromInstrument(instrument string) string {
	normalized := strings.ToUpper(strings.TrimSpace(instrument))
	if normalized == "" {
		return ""
	}

	return strings.TrimSuffix(normalized, "-PERP")
}

func normalizeHyperliquidWireDecimal(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("decimal value is required")
	}

	sign := ""
	switch trimmed[0] {
	case '+':
		trimmed = trimmed[1:]
	case '-':
		sign = "-"
		trimmed = trimmed[1:]
	}
	if trimmed == "" {
		return "", errors.New("decimal value is required")
	}

	parts := strings.Split(trimmed, ".")
	if len(parts) > 2 {
		return "", errors.New("decimal value must contain at most one decimal point")
	}

	intPart := parts[0]
	fracPart := ""
	if len(parts) == 2 {
		fracPart = parts[1]
	}

	if intPart == "" && fracPart == "" {
		return "", errors.New("decimal value is required")
	}
	if intPart != "" && !isDigitString(intPart) {
		return "", errors.New("integer part must contain digits only")
	}
	if fracPart != "" && !isDigitString(fracPart) {
		return "", errors.New("fractional part must contain digits only")
	}

	if intPart == "" {
		intPart = "0"
	}
	intPart = strings.TrimLeft(intPart, "0")
	if intPart == "" {
		intPart = "0"
	}

	fracPart = strings.TrimRight(fracPart, "0")
	normalized := intPart
	if fracPart != "" {
		normalized += "." + fracPart
	}
	if normalized == "0" {
		sign = ""
	}
	return sign + normalized, nil
}

func normalizeHyperliquidPerpPriceWire(price float64, szDecimals int) (string, error) {
	if math.IsNaN(price) || math.IsInf(price, 0) || price <= 0 {
		return "", errors.New("price must be a positive finite number")
	}

	rounded := roundToSignificantFigures(price, 5)
	maxDecimals := 6 - szDecimals
	if maxDecimals < 0 {
		maxDecimals = 0
	}
	rounded = roundToDecimals(rounded, maxDecimals)
	if rounded <= 0 {
		return "", errors.New("price rounds to zero with current tick precision")
	}

	raw := strconv.FormatFloat(rounded, 'f', maxDecimals, 64)
	return normalizeHyperliquidWireDecimal(raw)
}

func roundToDecimals(value float64, decimals int) float64 {
	if decimals < 0 {
		decimals = 0
	}
	pow := math.Pow(10, float64(decimals))
	return math.Round(value*pow) / pow
}

func roundToSignificantFigures(value float64, sigFigs int) float64 {
	if value == 0 {
		return 0
	}
	if sigFigs <= 0 {
		return value
	}

	absValue := math.Abs(value)
	integerPart := math.Floor(absValue)
	numIntegerDigits := 0
	if integerPart > 0 {
		temp := int(integerPart)
		for temp > 0 {
			temp /= 10
			numIntegerDigits++
		}

		if numIntegerDigits >= sigFigs {
			return math.Copysign(integerPart, value)
		}

		sigFigsLeft := sigFigs - numIntegerDigits
		rounded := roundToDecimals(absValue, sigFigsLeft)
		return math.Copysign(rounded, value)
	}

	multiplications := 0
	for absValue < 1 {
		absValue *= 10
		multiplications++
	}
	rounded := roundToDecimals(absValue, sigFigs-1)
	return math.Copysign(rounded/math.Pow(10, float64(multiplications)), value)
}

func isDigitString(value string) bool {
	for _, character := range value {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}

func resolvePerpAsset(metaPayload map[string]any, coin string) (int, error) {
	rawUniverse, ok := metaPayload["universe"].([]any)
	if !ok {
		return -1, errors.New("hyperliquid meta response is missing universe")
	}

	for index, entry := range rawUniverse {
		asset, ok := entry.(map[string]any)
		if !ok {
			continue
		}

		if strings.EqualFold(stringField(asset, "name"), coin) {
			return index, nil
		}
	}

	return -1, fmt.Errorf("unsupported instrument %s for hyperliquid", coin)
}

func resolvePerpAssetFromSDK(metaPayload *hyperliquid.Meta, coin string) (int, error) {
	if metaPayload == nil {
		return -1, errors.New("hyperliquid meta response is missing universe")
	}
	for index, asset := range metaPayload.Universe {
		if strings.EqualFold(strings.TrimSpace(asset.Name), coin) {
			return index, nil
		}
	}
	return -1, fmt.Errorf("unsupported instrument %s for hyperliquid", coin)
}

func isHyperliquidMainnetURL(baseURL string) bool {
	normalized := strings.ToLower(strings.TrimSpace(baseURL))
	if normalized == "" {
		return true
	}
	return !strings.Contains(normalized, "testnet")
}

func parseActionNonce(rawNonce any) (int64, error) {
	switch value := rawNonce.(type) {
	case float64:
		if math.IsNaN(value) ||
			math.IsInf(value, 0) ||
			math.Trunc(value) != value ||
			value < float64(-1<<63) ||
			value > float64(1<<63-1) {
			return 0, errors.New("unsignedActionPayload.action.nonce must be an integer")
		}
		return int64(value), nil
	case int64:
		return value, nil
	case int:
		return int64(value), nil
	case json.Number:
		parsed, err := value.Int64()
		if err != nil {
			return 0, errors.New("unsignedActionPayload.action.nonce must be an integer")
		}
		return parsed, nil
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err != nil {
			return 0, errors.New("unsignedActionPayload.action.nonce must be an integer")
		}
		return parsed, nil
	default:
		return 0, errors.New("unsignedActionPayload.action.nonce must be an integer")
	}
}

func buildHyperliquidSignTypedData(unsignedExchangeRequest map[string]any, isMainnet bool) (string, string, error) {
	action, hasAction := unsignedExchangeRequest["action"]
	if !hasAction {
		return "", "", errors.New("unsignedActionPayload.action.action must be a non-empty object")
	}
	nonce, err := parseActionNonce(unsignedExchangeRequest["nonce"])
	if err != nil {
		return "", "", err
	}

	return buildHyperliquidSignTypedDataFromAction(action, nonce, isMainnet)
}

func buildHyperliquidSignTypedDataFromAction(action any, nonce int64, isMainnet bool) (string, string, error) {
	connectionID, err := hyperliquidConnectionID(action, nonce)
	if err != nil {
		return "", "", err
	}

	source := "b"
	if isMainnet {
		source = "a"
	}
	typedData := map[string]any{
		"domain": map[string]any{
			"name":              "Exchange",
			"version":           "1",
			"chainId":           1337,
			"verifyingContract": "0x0000000000000000000000000000000000000000",
		},
		"types": map[string]any{
			"Agent": []map[string]string{
				{
					"name": "source",
					"type": "string",
				},
				{
					"name": "connectionId",
					"type": "bytes32",
				},
			},
			"EIP712Domain": []map[string]string{
				{
					"name": "name",
					"type": "string",
				},
				{
					"name": "version",
					"type": "string",
				},
				{
					"name": "chainId",
					"type": "uint256",
				},
				{
					"name": "verifyingContract",
					"type": "address",
				},
			},
		},
		"primaryType": "Agent",
		"message": map[string]string{
			"source":       source,
			"connectionId": connectionID,
		},
	}

	payload, err := json.Marshal(typedData)
	if err != nil {
		return "", "", err
	}
	return string(payload), connectionID, nil
}

func hyperliquidConnectionIDFromUnsignedAction(unsignedExchangeRequest map[string]any) (string, error) {
	action, ok := unsignedExchangeRequest["action"]
	if !ok {
		return "", errors.New("unsignedActionPayload.action.action must be a non-empty object")
	}
	nonce, err := parseActionNonce(unsignedExchangeRequest["nonce"])
	if err != nil {
		return "", err
	}

	return hyperliquidConnectionID(action, nonce)
}

func hyperliquidConnectionID(action any, nonce int64) (string, error) {
	if action == nil {
		return "", errors.New("unsignedActionPayload.action.action must be a non-empty object")
	}
	hash, err := hyperliquidActionHash(action, nonce, "", nil)
	if err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(hash), nil
}

func hyperliquidActionHash(
	action any,
	nonce int64,
	vaultAddress string,
	expiresAfter *int64,
) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := msgpack.NewEncoder(&buffer)
	encoder.UseCompactInts(true)
	encoder.SetSortMapKeys(false)
	if err := encoder.Encode(normalizeActionForSigningHash(action)); err != nil {
		return nil, fmt.Errorf("failed to encode action: %w", err)
	}

	data := convertMsgpackStr16ToStr8(buffer.Bytes())
	nonceBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(nonceBytes, uint64(nonce))
	data = append(data, nonceBytes...)

	if strings.TrimSpace(vaultAddress) == "" {
		data = append(data, 0x00)
	} else {
		data = append(data, 0x01)
		addressBytes, decodeErr := hex.DecodeString(strings.TrimPrefix(vaultAddress, "0x"))
		if decodeErr != nil {
			return nil, fmt.Errorf("invalid vault address: %w", decodeErr)
		}
		data = append(data, addressBytes...)
	}

	if expiresAfter != nil {
		data = append(data, 0x00)
		expiresAfterBytes := make([]byte, 8)
		binary.BigEndian.PutUint64(expiresAfterBytes, uint64(*expiresAfter))
		data = append(data, expiresAfterBytes...)
	}

	return crypto.Keccak256(data), nil
}

func normalizeActionForSigningHash(action any) any {
	actionRecord, isRecord := action.(map[string]any)
	if !isRecord {
		return action
	}
	actionType := strings.ToLower(strings.TrimSpace(stringField(actionRecord, "type")))
	switch actionType {
	case "order":
		payloadBytes, err := json.Marshal(actionRecord)
		if err != nil {
			return action
		}
		var canonical hyperliquid.OrderAction
		if unmarshalErr := json.Unmarshal(payloadBytes, &canonical); unmarshalErr != nil {
			return action
		}
		return canonical
	default:
		return action
	}
}

func convertMsgpackStr16ToStr8(data []byte) []byte {
	result := make([]byte, 0, len(data))
	for index := 0; index < len(data); {
		current := data[index]
		if current == 0xda && index+2 < len(data) {
			length := (int(data[index+1]) << 8) | int(data[index+2])
			if length < 256 {
				result = append(result, 0xd9, byte(length))
				index += 3
				if index+length <= len(data) {
					result = append(result, data[index:index+length]...)
					index += length
				}
				continue
			}
		}
		result = append(result, current)
		index++
	}
	return result
}

func parseHyperliquidWalletSignature(signature string) (map[string]any, error) {
	raw, err := decodeWalletSignatureBytes(signature)
	if err != nil {
		return nil, err
	}
	return buildHyperliquidWalletSignaturePayload(raw, false), nil
}

func buildHyperliquidWalletSignaturePayload(raw []byte, legacyV bool) map[string]any {
	v := int(raw[64])
	if legacyV && v < 27 {
		v += 27
	} else if !legacyV && v >= 27 && v <= 28 {
		v -= 27
	}

	return map[string]any{
		"r": "0x" + hex.EncodeToString(raw[0:32]),
		"s": "0x" + hex.EncodeToString(raw[32:64]),
		"v": v,
	}
}

func buildAlternateHyperliquidWalletSignaturePayload(raw []byte) (map[string]any, bool) {
	originalV := int(raw[64])
	switch originalV {
	case 0, 1:
		return buildHyperliquidWalletSignaturePayload(raw, true), true
	case 27, 28:
		return buildHyperliquidWalletSignaturePayload(raw, true), true
	default:
		return nil, false
	}
}

func decodeWalletSignatureBytes(signature string) ([]byte, error) {
	trimmed := strings.ToLower(strings.TrimSpace(signature))
	if len(trimmed) != 132 || !strings.HasPrefix(trimmed, "0x") {
		return nil, errors.New("signature must be a 65-byte hex value with 0x prefix")
	}
	raw, err := hex.DecodeString(trimmed[2:])
	if err != nil {
		return nil, errors.New("signature must be valid hex")
	}
	if len(raw) != 65 {
		return nil, errors.New("signature must be a 65-byte hex value with 0x prefix")
	}
	return raw, nil
}

func recoverHyperliquidTypedDataSigner(
	signature string,
	walletRequest walletRequestPayload,
) (string, string, error) {
	if !strings.EqualFold(strings.TrimSpace(walletRequest.Method), "eth_signTypedData_v4") {
		return "", "", errors.New("hyperliquid signed submit requires walletRequest.method to be eth_signTypedData_v4")
	}
	if len(walletRequest.Params) < 2 {
		return "", "", errors.New("hyperliquid signed submit requires walletRequest.params with signer and typed data payload")
	}

	requestedSigner, ok := walletRequest.Params[0].(string)
	if !ok || strings.TrimSpace(requestedSigner) == "" {
		return "", "", errors.New("walletRequest.params[0] must be a non-empty signer address")
	}
	normalizedRequestedSigner := strings.ToLower(strings.TrimSpace(requestedSigner))

	var typedDataRaw []byte
	switch typedDataValue := walletRequest.Params[1].(type) {
	case string:
		typedDataRaw = []byte(strings.TrimSpace(typedDataValue))
	case map[string]any:
		encoded, err := json.Marshal(typedDataValue)
		if err != nil {
			return "", "", errors.New("walletRequest.params[1] must be a valid typed data payload")
		}
		typedDataRaw = encoded
	default:
		return "", "", errors.New("walletRequest.params[1] must be a typed data JSON string or object")
	}
	if len(typedDataRaw) == 0 {
		return "", "", errors.New("walletRequest.params[1] must be a non-empty typed data payload")
	}

	var typedData apitypes.TypedData
	if err := json.Unmarshal(typedDataRaw, &typedData); err != nil {
		return "", "", errors.New("walletRequest.params[1] must be valid EIP-712 typed data")
	}
	if strings.TrimSpace(typedData.PrimaryType) == "" {
		return "", "", errors.New("walletRequest.params[1] typed data primaryType is required")
	}

	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return "", "", fmt.Errorf("failed to hash typed data domain: %w", err)
	}
	typedDataHash, err := typedData.HashStruct(typedData.PrimaryType, typedData.Message)
	if err != nil {
		return "", "", fmt.Errorf("failed to hash typed data message: %w", err)
	}
	rawMessage := []byte{0x19, 0x01}
	rawMessage = append(rawMessage, domainSeparator...)
	rawMessage = append(rawMessage, typedDataHash...)
	messageHash := crypto.Keccak256Hash(rawMessage)

	rawSignature, err := decodeWalletSignatureBytes(signature)
	if err != nil {
		return "", "", err
	}
	recoverySignature := append([]byte(nil), rawSignature...)
	if recoverySignature[64] >= 27 {
		recoverySignature[64] -= 27
	}
	if recoverySignature[64] > 1 {
		return "", "", errors.New("signature recovery id must be 0, 1, 27, or 28")
	}

	recoveredPubKey, err := crypto.SigToPub(messageHash.Bytes(), recoverySignature)
	if err != nil {
		return "", "", fmt.Errorf("failed to recover signer from typed data signature: %w", err)
	}
	recoveredSigner := strings.ToLower(crypto.PubkeyToAddress(*recoveredPubKey).Hex())
	return recoveredSigner, normalizedRequestedSigner, nil
}

func extractConnectionIDFromWalletRequest(walletRequest walletRequestPayload) string {
	if len(walletRequest.Params) < 2 {
		return ""
	}
	typedDataRaw, ok := walletRequest.Params[1].(string)
	if !ok {
		return ""
	}

	var typedData map[string]any
	if err := json.Unmarshal([]byte(typedDataRaw), &typedData); err != nil {
		return ""
	}
	message, ok := typedData["message"].(map[string]any)
	if !ok {
		return ""
	}
	connectionID, ok := message["connectionId"].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(connectionID)
}

func marshalActionToMap(action any) (map[string]any, error) {
	payload, err := json.Marshal(action)
	if err != nil {
		return nil, err
	}
	var actionMap map[string]any
	if err := json.Unmarshal(payload, &actionMap); err != nil {
		return nil, err
	}
	return actionMap, nil
}

func normalizeHyperliquidSubmissionStatus(exchangeResponse map[string]any) string {
	status := strings.ToLower(strings.TrimSpace(stringField(exchangeResponse, "status")))
	if status == "ok" || status == "" {
		status = "submitted"
	}

	if hasHyperliquidOrderError(exchangeResponse) {
		return "rejected"
	}
	return status
}

func normalizeHyperliquidOrderStatus(venueStatus string) string {
	normalizedVenueStatus := strings.ToLower(strings.TrimSpace(venueStatus))
	if normalizedVenueStatus == "" {
		return "unknown"
	}
	if normalizedVenueStatus == "filled" {
		return "filled"
	}
	if normalizedVenueStatus == "open" || normalizedVenueStatus == "triggered" {
		return "open"
	}
	if strings.Contains(normalizedVenueStatus, "rejected") {
		return "rejected"
	}
	if strings.Contains(normalizedVenueStatus, "canceled") || normalizedVenueStatus == "cancelled" {
		return "cancelled"
	}
	return "submitted"
}

func extractHyperliquidOrderStatusValue(statusPayload map[string]any) string {
	topLevelStatus := strings.ToLower(strings.TrimSpace(stringField(statusPayload, "status")))
	if topLevelStatus != "" && topLevelStatus != "order" {
		return topLevelStatus
	}

	order, hasOrder := statusPayload["order"].(map[string]any)
	if !hasOrder {
		return topLevelStatus
	}

	nestedStatus := strings.ToLower(strings.TrimSpace(stringField(order, "status")))
	if nestedStatus != "" {
		return nestedStatus
	}

	return topLevelStatus
}

func isHyperliquidOrderStatusTerminal(normalizedStatus string) bool {
	switch strings.ToLower(strings.TrimSpace(normalizedStatus)) {
	case "filled", "cancelled", "rejected":
		return true
	default:
		return false
	}
}

func hasHyperliquidOrderError(exchangeResponse map[string]any) bool {
	response, ok := exchangeResponse["response"].(map[string]any)
	if !ok {
		return false
	}
	data, ok := response["data"].(map[string]any)
	if !ok {
		return false
	}
	statuses, ok := data["statuses"].([]any)
	if !ok || len(statuses) == 0 {
		return false
	}
	firstStatus, ok := statuses[0].(map[string]any)
	if !ok {
		return false
	}
	_, hasError := firstStatus["error"]
	return hasError
}

func extractHyperliquidOrderError(exchangeResponse map[string]any) string {
	response, ok := exchangeResponse["response"].(map[string]any)
	if !ok {
		return ""
	}
	data, ok := response["data"].(map[string]any)
	if !ok {
		return ""
	}
	statuses, ok := data["statuses"].([]any)
	if !ok || len(statuses) == 0 {
		return ""
	}
	firstStatus, ok := statuses[0].(map[string]any)
	if !ok {
		return ""
	}

	rawError, hasError := firstStatus["error"]
	if !hasError || rawError == nil {
		return ""
	}
	switch typedError := rawError.(type) {
	case string:
		return strings.TrimSpace(typedError)
	case map[string]any:
		payload, err := json.Marshal(typedError)
		if err != nil {
			return "hyperliquid order status included a non-string error payload"
		}
		return string(payload)
	default:
		return "hyperliquid order status included an unknown error payload"
	}
}

func extractHyperliquidSubmissionDebugReason(exchangeResponse map[string]any) *string {
	status := strings.ToLower(strings.TrimSpace(stringField(exchangeResponse, "status")))
	orderError := strings.TrimSpace(extractHyperliquidOrderError(exchangeResponse))
	if orderError != "" {
		return &orderError
	}
	if status == "" || status == "ok" || status == "submitted" {
		return nil
	}

	switch responsePayload := exchangeResponse["response"].(type) {
	case string:
		trimmed := strings.TrimSpace(responsePayload)
		if trimmed != "" && strings.ToLower(trimmed) != "ok" {
			return &trimmed
		}
	case map[string]any:
		encoded, err := json.Marshal(responsePayload)
		if err == nil {
			trimmed := strings.TrimSpace(string(encoded))
			if trimmed != "" && trimmed != "{}" {
				return &trimmed
			}
		}
	}

	if status != "" && status != "ok" && status != "submitted" {
		reason := fmt.Sprintf("upstream exchange returned status %q", status)
		return &reason
	}
	return nil
}

func marshalDebugJSON(payload any) string {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return `{"marshal":"failed"}`
	}
	return string(encoded)
}

func extractHyperliquidVenueOrderID(exchangeResponse map[string]any) *string {
	response, ok := exchangeResponse["response"].(map[string]any)
	if !ok {
		return nil
	}
	data, ok := response["data"].(map[string]any)
	if !ok {
		return nil
	}
	statuses, ok := data["statuses"].([]any)
	if !ok || len(statuses) == 0 {
		return nil
	}
	firstStatus, ok := statuses[0].(map[string]any)
	if !ok {
		return nil
	}

	restingOrderID := extractNumericID(firstStatus, "resting", "oid")
	if restingOrderID != nil {
		return restingOrderID
	}
	filledOrderID := extractNumericID(firstStatus, "filled", "oid")
	if filledOrderID != nil {
		return filledOrderID
	}

	return nil
}

func extractNumericID(values map[string]any, parentKey string, key string) *string {
	parent, ok := values[parentKey].(map[string]any)
	if !ok {
		return nil
	}
	switch value := parent[key].(type) {
	case float64:
		id := strconv.FormatInt(int64(value), 10)
		return &id
	case int64:
		id := strconv.FormatInt(value, 10)
		return &id
	case int:
		id := strconv.Itoa(value)
		return &id
	case json.Number:
		id := value.String()
		if strings.TrimSpace(id) == "" {
			return nil
		}
		return &id
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return nil
		}
		return &trimmed
	default:
		return nil
	}
}
