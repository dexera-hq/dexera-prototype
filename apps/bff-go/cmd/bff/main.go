package main

import (
	"log"
	"net/http"
	"os"

	httphandlers "github.com/dexera/dexera-prototype/apps/bff-go/internal/http"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := httphandlers.NewMux()
	addr := ":" + port
	log.Printf("dexera-bff listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
