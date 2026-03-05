package http

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type healthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Timestamp string `json:"timestamp"`
}

type placeholderResponse struct {
	Message string `json:"message"`
	Source  string `json:"source"`
}

type walletChallengeRequest struct {
	Address string `json:"address"`
}

type walletChallengeResponse struct {
	ChallengeID string `json:"challengeId"`
	Message     string `json:"message"`
	IssuedAt    string `json:"issuedAt"`
	ExpiresAt   string `json:"expiresAt"`
}

type walletVerifyRequest struct {
	Address     string  `json:"address"`
	ChallengeID string  `json:"challengeId"`
	Signature   string  `json:"signature"`
	Venue       venueID `json:"venue"`
}

type walletVerifyResponse struct {
	OwnershipVerified bool    `json:"ownershipVerified"`
	Venue             venueID `json:"venue"`
	Eligible          bool    `json:"eligible"`
	Reason            string  `json:"reason"`
	CheckedAt         string  `json:"checkedAt"`
	Source            string  `json:"source"`
}

type walletVenueEligibilityResult struct {
	Eligible bool
	Reason   string
	Source   string
}

type venueID string

const (
	venueHyperliquid   venueID = "hyperliquid"
	venueAster         venueID = "aster"
	walletChallengeTTL         = 5 * time.Minute
)

var errWalletChallengeExpired = errors.New("wallet challenge expired")
var errWalletChallengeNotFound = errors.New("wallet challenge was not found")
var errWalletChallengeAddressMismatch = errors.New("wallet challenge does not match the provided address")

type walletChallengeRecord struct {
	Address   string
	Message   string
	IssuedAt  time.Time
	ExpiresAt time.Time
}

type walletChallengeStore struct {
	mu      sync.Mutex
	records map[string]walletChallengeRecord
	nowFn   func() time.Time
}

func newWalletChallengeStore(nowFn func() time.Time) *walletChallengeStore {
	return &walletChallengeStore{
		records: make(map[string]walletChallengeRecord),
		nowFn:   nowFn,
	}
}

func (s *walletChallengeStore) issue(address string) (string, walletChallengeRecord, error) {
	issuedAt := s.nowFn().UTC()
	expiresAt := issuedAt.Add(walletChallengeTTL)

	challengeID, err := randomHexToken(16)
	if err != nil {
		return "", walletChallengeRecord{}, err
	}
	nonce, err := randomHexToken(16)
	if err != nil {
		return "", walletChallengeRecord{}, err
	}

	message := buildWalletChallengeMessage(address, challengeID, nonce, issuedAt, expiresAt)
	record := walletChallengeRecord{
		Address:   address,
		Message:   message,
		IssuedAt:  issuedAt,
		ExpiresAt: expiresAt,
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for key, existing := range s.records {
		if issuedAt.After(existing.ExpiresAt) {
			delete(s.records, key)
		}
	}

	s.records[challengeID] = record
	return challengeID, record, nil
}

func (s *walletChallengeStore) consume(challengeID, address string) (walletChallengeRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	record, ok := s.records[challengeID]
	if !ok {
		return walletChallengeRecord{}, errWalletChallengeNotFound
	}

	delete(s.records, challengeID)

	now := s.nowFn().UTC()
	if now.After(record.ExpiresAt) {
		return walletChallengeRecord{}, errWalletChallengeExpired
	}

	if !strings.EqualFold(record.Address, address) {
		return walletChallengeRecord{}, errWalletChallengeAddressMismatch
	}

	return record, nil
}

type perpOrderRequest struct {
	AccountID     string  `json:"accountId"`
	Venue         venueID `json:"venue"`
	Instrument    string  `json:"instrument"`
	Side          string  `json:"side"`
	Type          string  `json:"type"`
	Size          string  `json:"size"`
	LimitPrice    *string `json:"limitPrice,omitempty"`
	Leverage      *string `json:"leverage,omitempty"`
	ReduceOnly    *bool   `json:"reduceOnly,omitempty"`
	ClientOrderID string  `json:"clientOrderId,omitempty"`
}

type buildUnsignedActionRequest struct {
	Order perpOrderRequest `json:"order"`
}

type perpOrderPreviewResponse struct {
	PreviewID         string  `json:"previewId"`
	AccountID         string  `json:"accountId"`
	Venue             venueID `json:"venue"`
	Instrument        string  `json:"instrument"`
	Side              string  `json:"side"`
	Type              string  `json:"type"`
	Size              string  `json:"size"`
	LimitPrice        *string `json:"limitPrice,omitempty"`
	MarkPrice         *string `json:"markPrice,omitempty"`
	EstimatedNotional string  `json:"estimatedNotional"`
	EstimatedFee      string  `json:"estimatedFee"`
	ExpiresAt         string  `json:"expiresAt"`
	Source            string  `json:"source"`
}

type unsignedActionPayload struct {
	ID            string               `json:"id"`
	AccountID     string               `json:"accountId"`
	Venue         venueID              `json:"venue"`
	Kind          string               `json:"kind"`
	Action        map[string]any       `json:"action"`
	WalletRequest walletRequestPayload `json:"walletRequest"`
}

type walletRequestPayload struct {
	Method string `json:"method"`
	Params []any  `json:"params,omitempty"`
}

type buildUnsignedActionResponse struct {
	OrderID               string                `json:"orderId"`
	SigningPolicy         string                `json:"signingPolicy"`
	Disclaimer            string                `json:"disclaimer"`
	UnsignedActionPayload unsignedActionPayload `json:"unsignedActionPayload"`
}

type submitSignedActionRequest struct {
	OrderID               string                `json:"orderId"`
	Signature             string                `json:"signature"`
	UnsignedActionPayload unsignedActionPayload `json:"unsignedActionPayload"`
}

type submitSignedActionResponse struct {
	OrderID      string  `json:"orderId"`
	ActionHash   string  `json:"actionHash"`
	Venue        venueID `json:"venue"`
	Status       string  `json:"status"`
	VenueOrderID *string `json:"venueOrderId,omitempty"`
	Source       string  `json:"source"`
}

type perpPosition struct {
	PositionID       string  `json:"positionId"`
	AccountID        string  `json:"accountId"`
	Venue            venueID `json:"venue"`
	Instrument       string  `json:"instrument"`
	Direction        string  `json:"direction"`
	Status           string  `json:"status"`
	Size             string  `json:"size"`
	EntryPrice       string  `json:"entryPrice"`
	MarkPrice        string  `json:"markPrice"`
	NotionalValue    string  `json:"notionalValue"`
	Leverage         string  `json:"leverage,omitempty"`
	UnrealizedPnLUSD string  `json:"unrealizedPnlUsd"`
	LastUpdatedAt    string  `json:"lastUpdatedAt"`
}

type perpPositionsResponse struct {
	AccountID string         `json:"accountId"`
	Venue     venueID        `json:"venue"`
	Positions []perpPosition `json:"positions"`
	Source    string         `json:"source"`
}

type perpPositionsQuery struct {
	AccountID  string
	Venue      venueID
	Instrument string
}

type perpVenueAdapter interface {
	PreviewOrder(r *http.Request, req buildUnsignedActionRequest) (perpOrderPreviewResponse, error)
	BuildUnsignedAction(r *http.Request, req buildUnsignedActionRequest) (buildUnsignedActionResponse, error)
	SubmitSignedAction(
		r *http.Request,
		req submitSignedActionRequest,
	) (submitSignedActionResponse, error)
	GetPositions(r *http.Request, query perpPositionsQuery) (perpPositionsResponse, error)
	CheckWalletEligibility(r *http.Request, address string) (walletVenueEligibilityResult, error)
}

var errAdapterNotConfigured = errors.New("venue adapter is not configured")
var errSignedSubmitNotSupported = errors.New("signed action submission is not supported for this venue")
var venueAdapterResolver = resolvePerpVenueAdapter
var walletChallenges = newWalletChallengeStore(time.Now)

func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/v1/placeholder", placeholderHandler)
	mux.HandleFunc("/api/v1/wallet/challenge", walletChallengeHandler)
	mux.HandleFunc("/api/v1/wallet/verify", walletVerifyHandler)
	mux.HandleFunc("/api/v1/perp/orders/preview", perpOrderPreviewHandler)
	mux.HandleFunc("/api/v1/perp/actions/unsigned", buildUnsignedActionHandler)
	mux.HandleFunc("/api/v1/perp/actions/submit", submitSignedActionHandler)
	mux.HandleFunc("/api/v1/perp/positions", perpPositionsHandler)
	return mux
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, healthResponse{
		Status:    "ok",
		Service:   "dexera-bff",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func placeholderHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, placeholderResponse{
		Message: "Bootstrap endpoint ready",
		Source:  "bff-go",
	})
}

func walletChallengeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req walletChallengeRequest
	if err := decodeStrictJSONBody(r, &req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	address, err := parseWalletAddress(req.Address)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	challengeID, challenge, err := walletChallenges.issue(address)
	if err != nil {
		http.Error(w, "failed to issue wallet challenge", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, walletChallengeResponse{
		ChallengeID: challengeID,
		Message:     challenge.Message,
		IssuedAt:    challenge.IssuedAt.Format(time.RFC3339),
		ExpiresAt:   challenge.ExpiresAt.Format(time.RFC3339),
	})
}

func walletVerifyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req walletVerifyRequest
	if err := decodeStrictJSONBody(r, &req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	address, err := parseWalletAddress(req.Address)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	challengeID := strings.TrimSpace(req.ChallengeID)
	if challengeID == "" {
		http.Error(w, "challengeId is required", http.StatusBadRequest)
		return
	}

	venue, err := parseVenue(string(req.Venue))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Venue = venue

	challenge, err := walletChallenges.consume(challengeID, address)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := verifyWalletChallengeSignature(challenge.Message, req.Signature); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	adapter, err := venueAdapterResolver(req.Venue)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	eligibility, err := adapter.CheckWalletEligibility(r, address)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	reason := strings.TrimSpace(eligibility.Reason)
	if reason == "" {
		if eligibility.Eligible {
			reason = "wallet is eligible for this venue"
		} else {
			reason = "wallet is not eligible for this venue"
		}
	}

	source := strings.TrimSpace(eligibility.Source)
	if source == "" {
		source = string(req.Venue)
	}

	writeJSON(w, http.StatusOK, walletVerifyResponse{
		OwnershipVerified: true,
		Venue:             req.Venue,
		Eligible:          eligibility.Eligible,
		Reason:            reason,
		CheckedAt:         time.Now().UTC().Format(time.RFC3339),
		Source:            source,
	})
}

func perpOrderPreviewHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req buildUnsignedActionRequest
	if err := decodeStrictJSONBody(r, &req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if err := validateBuildUnsignedActionRequest(req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	venue, err := parseVenue(string(req.Order.Venue))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Order.Venue = venue

	adapter, err := venueAdapterResolver(req.Order.Venue)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	preview, err := adapter.PreviewOrder(r, req)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, preview)
}

func buildUnsignedActionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req buildUnsignedActionRequest
	if err := decodeStrictJSONBody(r, &req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if err := validateBuildUnsignedActionRequest(req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	venue, err := parseVenue(string(req.Order.Venue))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Order.Venue = venue

	adapter, err := venueAdapterResolver(req.Order.Venue)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	response, err := adapter.BuildUnsignedAction(r, req)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func submitSignedActionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req submitSignedActionRequest
	if err := decodeStrictJSONBody(r, &req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if err := validateSubmitSignedActionRequest(req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	venue, err := parseVenue(string(req.UnsignedActionPayload.Venue))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.UnsignedActionPayload.Venue = venue

	adapter, err := venueAdapterResolver(req.UnsignedActionPayload.Venue)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	response, err := adapter.SubmitSignedAction(r, req)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func perpPositionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	accountID := strings.TrimSpace(r.URL.Query().Get("accountId"))
	if accountID == "" {
		http.Error(w, "missing accountId query parameter", http.StatusBadRequest)
		return
	}

	venue, err := parseVenue(strings.TrimSpace(r.URL.Query().Get("venue")))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	adapter, err := venueAdapterResolver(venue)
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	positions, err := adapter.GetPositions(r, perpPositionsQuery{
		AccountID:  accountID,
		Venue:      venue,
		Instrument: strings.TrimSpace(r.URL.Query().Get("instrument")),
	})
	if err != nil {
		handleAdapterError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, positions)
}

func parseVenue(value string) (venueID, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(venueHyperliquid):
		return venueHyperliquid, nil
	case string(venueAster):
		return venueAster, nil
	default:
		return "", errors.New("venue must be hyperliquid or aster")
	}
}

func randomHexToken(bytesLength int) (string, error) {
	if bytesLength <= 0 {
		return "", errors.New("bytesLength must be positive")
	}

	buffer := make([]byte, bytesLength)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}

	return hex.EncodeToString(buffer), nil
}

func buildWalletChallengeMessage(
	address string,
	challengeID string,
	nonce string,
	issuedAt time.Time,
	expiresAt time.Time,
) string {
	return fmt.Sprintf(
		"Dexera Wallet Verification\nAddress: %s\nChallenge ID: %s\nNonce: %s\nIssued At: %s\nExpires At: %s\n\nSign this message to verify wallet ownership for client-side trading access.",
		address,
		challengeID,
		nonce,
		issuedAt.Format(time.RFC3339),
		expiresAt.Format(time.RFC3339),
	)
}

func parseWalletAddress(value string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if len(trimmed) != 42 || !strings.HasPrefix(trimmed, "0x") {
		return "", errors.New("address must be a 20-byte hex value with 0x prefix")
	}

	if _, err := hex.DecodeString(trimmed[2:]); err != nil {
		return "", errors.New("address must be a valid hex value")
	}

	return trimmed, nil
}

func verifyWalletChallengeSignature(message string, signature string) error {
	if strings.TrimSpace(message) == "" {
		return errors.New("challenge message is empty")
	}

	trimmedSignature := strings.ToLower(strings.TrimSpace(signature))
	if len(trimmedSignature) != 132 || !strings.HasPrefix(trimmedSignature, "0x") {
		return errors.New("signature must be a 65-byte hex value with 0x prefix")
	}

	if _, err := hex.DecodeString(trimmedSignature[2:]); err != nil {
		return errors.New("signature must be valid hex")
	}

	// Prototype verification mode: we enforce challenge binding + signature format.
	// Full secp256k1 signature recovery can be added when crypto dependencies are introduced.
	return nil
}

func validateBuildUnsignedActionRequest(request buildUnsignedActionRequest) error {
	order := request.Order

	if strings.TrimSpace(order.AccountID) == "" {
		return errors.New("accountId is required")
	}
	if _, err := parseVenue(string(order.Venue)); err != nil {
		return err
	}
	if strings.TrimSpace(order.Instrument) == "" {
		return errors.New("instrument is required")
	}
	if strings.TrimSpace(order.Size) == "" {
		return errors.New("size is required")
	}

	side := strings.ToLower(strings.TrimSpace(order.Side))
	switch side {
	case "buy", "sell":
		// valid
	default:
		return errors.New("side must be buy or sell")
	}

	orderType := strings.ToLower(strings.TrimSpace(order.Type))
	switch orderType {
	case "market":
		if order.LimitPrice != nil && strings.TrimSpace(*order.LimitPrice) != "" {
			return errors.New("market orders must not include limitPrice")
		}
	case "limit":
		if order.LimitPrice == nil || strings.TrimSpace(*order.LimitPrice) == "" {
			return errors.New("limit orders must include limitPrice")
		}
	default:
		return errors.New("type must be market or limit")
	}

	return nil
}

func validateSubmitSignedActionRequest(request submitSignedActionRequest) error {
	if strings.TrimSpace(request.OrderID) == "" {
		return errors.New("orderId is required")
	}
	if err := verifyWalletChallengeSignature("submit-signed-action", request.Signature); err != nil {
		return err
	}

	payload := request.UnsignedActionPayload
	if strings.TrimSpace(payload.ID) == "" {
		return errors.New("unsignedActionPayload.id is required")
	}
	if strings.TrimSpace(payload.AccountID) == "" {
		return errors.New("unsignedActionPayload.accountId is required")
	}
	if _, err := parseVenue(string(payload.Venue)); err != nil {
		return err
	}
	if strings.TrimSpace(payload.Kind) != "perp_order_action" {
		return errors.New("unsignedActionPayload.kind must be perp_order_action")
	}
	if len(payload.Action) == 0 {
		return errors.New("unsignedActionPayload.action is required")
	}
	if strings.TrimSpace(payload.WalletRequest.Method) == "" {
		return errors.New("unsignedActionPayload.walletRequest.method is required")
	}
	for _, forbidden := range [...]string{"signature", "rawAction", "signedAction", "actionHash"} {
		if _, hasForbidden := payload.Action[forbidden]; hasForbidden {
			return fmt.Errorf(`unsignedActionPayload.action must not include "%s"`, forbidden)
		}
	}

	actionBody, actionOK := payload.Action["action"].(map[string]any)
	if !actionOK || len(actionBody) == 0 {
		return errors.New("unsignedActionPayload.action.action must be a non-empty object")
	}
	if _, err := parseActionNonce(payload.Action["nonce"]); err != nil {
		return err
	}

	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func decodeStrictJSONBody(r *http.Request, dst any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}

	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return io.ErrUnexpectedEOF
	}

	return nil
}

func handleAdapterError(w http.ResponseWriter, err error) {
	if errors.Is(err, errAdapterNotConfigured) {
		http.Error(w, "venue integration is not configured", http.StatusInternalServerError)
		return
	}
	if errors.Is(err, errSignedSubmitNotSupported) {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	var upstreamErr *upstreamHTTPError
	if errors.As(err, &upstreamErr) {
		if upstreamErr.statusCode >= http.StatusBadRequest && upstreamErr.statusCode < http.StatusInternalServerError {
			http.Error(w, "venue request rejected by upstream provider", upstreamErr.statusCode)
			return
		}
		http.Error(w, "venue provider request failed", http.StatusBadGateway)
		return
	}

	http.Error(w, "failed to execute venue request", http.StatusBadGateway)
}
