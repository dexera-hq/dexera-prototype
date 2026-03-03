package http

import (
	"encoding/json"
	"net/http"
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

func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/api/v1/placeholder", placeholderHandler)
	mux.HandleFunc("/api/v1/transactions/unsigned", buildUnsignedTransactionHandler)
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

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
