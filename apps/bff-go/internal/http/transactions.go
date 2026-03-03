package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const clientSigningOnlyDisclaimer = "Transactions are prepared server-side as unsigned payloads only. Your wallet signs locally in the browser."

type buildUnsignedTransactionRequest struct {
	Order orderRequest `json:"order"`
}

type orderRequest struct {
	WalletAddress string  `json:"walletAddress"`
	ChainID       int     `json:"chainId"`
	Symbol        string  `json:"symbol"`
	Side          string  `json:"side"`
	Type          string  `json:"type"`
	Quantity      string  `json:"quantity"`
	LimitPrice    *string `json:"limitPrice,omitempty"`
}

type unsignedTxPayloadResponse struct {
	ID                   string `json:"id"`
	WalletAddress        string `json:"walletAddress"`
	ChainID              int    `json:"chainId"`
	Kind                 string `json:"kind"`
	To                   string `json:"to"`
	Data                 string `json:"data"`
	Value                string `json:"value"`
	GasLimit             string `json:"gasLimit,omitempty"`
	MaxFeePerGas         string `json:"maxFeePerGas,omitempty"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas,omitempty"`
	Nonce                *int   `json:"nonce,omitempty"`
}

type buildUnsignedTransactionResponse struct {
	OrderID           string                    `json:"orderId"`
	SigningPolicy     string                    `json:"signingPolicy"`
	Disclaimer        string                    `json:"disclaimer"`
	UnsignedTxPayload unsignedTxPayloadResponse `json:"unsignedTxPayload"`
}

func buildUnsignedTransactionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request buildUnsignedTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := validateUnsignedTransactionRequest(request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	response := buildUnsignedTransactionResponse{
		OrderID:       fmt.Sprintf("ord_%d", time.Now().UTC().UnixNano()),
		SigningPolicy: "client-signing-only",
		Disclaimer:    clientSigningOnlyDisclaimer,
		UnsignedTxPayload: unsignedTxPayloadResponse{
			ID:                   fmt.Sprintf("utxp_%d", time.Now().UTC().UnixNano()),
			WalletAddress:        request.Order.WalletAddress,
			ChainID:              request.Order.ChainID,
			Kind:                 "evm_transaction",
			To:                   "0x1111111111111111111111111111111111111111",
			Data:                 "0xdeadbeef",
			Value:                "0",
			GasLimit:             "210000",
			MaxFeePerGas:         "25000000000",
			MaxPriorityFeePerGas: "1500000000",
		},
	}

	if err := validateUnsignedTransactionResponse(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func validateUnsignedTransactionRequest(request buildUnsignedTransactionRequest) error {
	order := request.Order

	if strings.TrimSpace(order.WalletAddress) == "" {
		return fmt.Errorf("walletAddress is required")
	}
	if order.ChainID <= 0 {
		return fmt.Errorf("chainId must be a positive integer")
	}
	if strings.TrimSpace(order.Symbol) == "" {
		return fmt.Errorf("symbol is required")
	}
	if strings.TrimSpace(order.Quantity) == "" {
		return fmt.Errorf("quantity is required")
	}

	switch order.Side {
	case "buy", "sell":
	default:
		return fmt.Errorf("side must be buy or sell")
	}

	switch order.Type {
	case "market":
		if order.LimitPrice != nil && strings.TrimSpace(*order.LimitPrice) != "" {
			return fmt.Errorf("market orders must not include limitPrice")
		}
	case "limit":
		if order.LimitPrice == nil || strings.TrimSpace(*order.LimitPrice) == "" {
			return fmt.Errorf("limit orders must include limitPrice")
		}
	default:
		return fmt.Errorf("type must be market or limit")
	}

	return nil
}

func validateUnsignedTransactionResponse(response buildUnsignedTransactionResponse) error {
	if response.SigningPolicy != "client-signing-only" {
		return fmt.Errorf("server must only emit client-signing-only payloads")
	}

	payload := response.UnsignedTxPayload
	if payload.ChainID <= 0 {
		return fmt.Errorf("unsigned transaction payload must include a positive chainId")
	}
	if strings.TrimSpace(payload.ID) == "" ||
		strings.TrimSpace(payload.WalletAddress) == "" ||
		strings.TrimSpace(payload.Kind) == "" ||
		strings.TrimSpace(payload.To) == "" ||
		strings.TrimSpace(payload.Data) == "" ||
		strings.TrimSpace(payload.Value) == "" {
		return fmt.Errorf("unsigned transaction payload is missing required fields")
	}

	return nil
}
