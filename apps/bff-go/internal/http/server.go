package http

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
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

type quoteRequest struct {
	ChainID      int    `json:"chainId"`
	SellToken    string `json:"sellToken"`
	BuyToken     string `json:"buyToken"`
	SellAmount   string `json:"sellAmount"`
	Wallet       string `json:"wallet"`
	SlippageBPS  int    `json:"slippageBps"`
	AffiliateTag string `json:"affiliateTag,omitempty"`
}

type quoteResponse struct {
	QuoteID      string `json:"quoteId"`
	ChainID      int    `json:"chainId"`
	SellToken    string `json:"sellToken"`
	BuyToken     string `json:"buyToken"`
	SellAmount   string `json:"sellAmount"`
	EstimatedOut string `json:"estimatedOut"`
	Price        string `json:"price"`
	ExpiresAt    string `json:"expiresAt"`
	Source       string `json:"source"`
}

type buildTransactionRequest struct {
	QuoteID string `json:"quoteId"`
	Wallet  string `json:"wallet"`
	ChainID int    `json:"chainId"`
}

type unsignedTransaction struct {
	To                   string `json:"to"`
	Data                 string `json:"data"`
	Value                string `json:"value"`
	GasLimit             string `json:"gasLimit"`
	MaxFeePerGas         string `json:"maxFeePerGas"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
	ChainID              int    `json:"chainId"`
}

type buildTransactionResponse struct {
	BuildID    string              `json:"buildId"`
	QuoteID    string              `json:"quoteId"`
	Wallet     string              `json:"wallet"`
	UnsignedTx unsignedTransaction `json:"unsignedTx"`
	Warnings   []string            `json:"warnings"`
	Simulated  bool                `json:"simulated"`
	Source     string              `json:"source"`
}

type position struct {
	PositionID       string `json:"positionId"`
	ChainID          int    `json:"chainId"`
	Protocol         string `json:"protocol"`
	Asset            string `json:"asset"`
	Balance          string `json:"balance"`
	USDValue         string `json:"usdValue"`
	UnrealizedPnLUSD string `json:"unrealizedPnlUsd"`
	LastUpdatedAt    string `json:"lastUpdatedAt"`
}

type positionsResponse struct {
	Wallet    string     `json:"wallet"`
	ChainID   int        `json:"chainId,omitempty"`
	Positions []position `json:"positions"`
	Source    string     `json:"source"`
}

func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/v1/placeholder", placeholderHandler)
	mux.HandleFunc("/api/v1/quotes", quoteHandler)
	mux.HandleFunc("/api/v1/transactions/build", buildTransactionHandler)
	mux.HandleFunc("/api/v1/positions", positionsHandler)
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

func quoteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req quoteRequest
	if err := decodeStrictJSONBody(r, &req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.ChainID == 0 || req.SellToken == "" || req.BuyToken == "" || req.SellAmount == "" || req.Wallet == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusOK, quoteResponse{
		QuoteID:      "quote_mock_001",
		ChainID:      req.ChainID,
		SellToken:    req.SellToken,
		BuyToken:     req.BuyToken,
		SellAmount:   req.SellAmount,
		EstimatedOut: "1234500000000000000",
		Price:        "1.2345",
		ExpiresAt:    time.Now().UTC().Add(30 * time.Second).Format(time.RFC3339),
		Source:       "mock",
	})
}

func buildTransactionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req buildTransactionRequest
	if err := decodeStrictJSONBody(r, &req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.QuoteID == "" || req.Wallet == "" || req.ChainID <= 0 {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusOK, buildTransactionResponse{
		BuildID: "txbuild_mock_001",
		QuoteID: req.QuoteID,
		Wallet:  req.Wallet,
		UnsignedTx: unsignedTransaction{
			To:                   "0x1111111111111111111111111111111111111111",
			Data:                 "0xdeadbeef",
			Value:                "0",
			GasLimit:             "250000",
			MaxFeePerGas:         "35000000000",
			MaxPriorityFeePerGas: "2000000000",
			ChainID:              req.ChainID,
		},
		Warnings:  []string{"Mock transaction: values are placeholders and not broadcastable"},
		Simulated: false,
		Source:    "mock",
	})
}

func positionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	wallet := r.URL.Query().Get("wallet")
	if wallet == "" {
		http.Error(w, "missing wallet query parameter", http.StatusBadRequest)
		return
	}

	chainID := 1
	if chainIDParam := r.URL.Query().Get("chainId"); chainIDParam != "" {
		parsedChainID, err := strconv.Atoi(chainIDParam)
		if err != nil || parsedChainID <= 0 {
			http.Error(w, "invalid chainId query parameter", http.StatusBadRequest)
			return
		}
		chainID = parsedChainID
	}

	now := time.Now().UTC().Format(time.RFC3339)
	writeJSON(w, http.StatusOK, positionsResponse{
		Wallet:  wallet,
		ChainID: chainID,
		Positions: []position{
			{
				PositionID:       "pos_mock_eth_001",
				ChainID:          chainID,
				Protocol:         "wallet",
				Asset:            "ETH",
				Balance:          "0.42",
				USDValue:         "1468.22",
				UnrealizedPnLUSD: "0",
				LastUpdatedAt:    now,
			},
			{
				PositionID:       "pos_mock_usdc_001",
				ChainID:          chainID,
				Protocol:         "wallet",
				Asset:            "USDC",
				Balance:          "1250.00",
				USDValue:         "1250.00",
				UnrealizedPnLUSD: "0",
				LastUpdatedAt:    now,
			},
		},
		Source: "mock",
	})
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
