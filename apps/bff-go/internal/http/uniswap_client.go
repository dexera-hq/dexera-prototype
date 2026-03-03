package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultUniswapTradingAPIBaseURL = "https://trade-api.gateway.uniswap.org/v1"

type uniswapClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

type upstreamHTTPError struct {
	op         string
	statusCode int
}

func (e *upstreamHTTPError) Error() string {
	return fmt.Sprintf("%s returned status %d", e.op, e.statusCode)
}

func newUniswapClientFromEnv() (*uniswapClient, error) {
	apiKey := strings.TrimSpace(os.Getenv("UNISWAP_TRADING_API_KEY"))
	if apiKey == "" {
		return nil, fmt.Errorf("missing UNISWAP_TRADING_API_KEY")
	}

	baseURL := strings.TrimSpace(os.Getenv("UNISWAP_TRADING_API_BASE_URL"))
	if baseURL == "" {
		baseURL = defaultUniswapTradingAPIBaseURL
	}
	baseURL = strings.TrimRight(baseURL, "/")

	return &uniswapClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
	}, nil
}

func (c *uniswapClient) quote(ctx context.Context, req quoteRequest) (map[string]any, error) {
	payload := map[string]any{
		"type":            "EXACT_INPUT",
		"amount":          req.SellAmount,
		"tokenIn":         req.SellToken,
		"tokenOut":        req.BuyToken,
		"swapper":         req.Wallet,
		"tokenInChainId":  req.ChainID,
		"tokenOutChainId": req.ChainID,
	}

	if req.SlippageBPS > 0 {
		payload["slippageTolerance"] = float64(req.SlippageBPS) / 100.0
	}
	if req.AffiliateTag != "" {
		payload["affiliate"] = req.AffiliateTag
	}

	return c.postJSON(ctx, "quote", payload)
}

func (c *uniswapClient) checkApproval(
	ctx context.Context,
	req quoteRequest,
	quotePayload map[string]any,
) (map[string]any, error) {
	approvalReq := map[string]any{
		"token":         req.SellToken,
		"amount":        req.SellAmount,
		"walletAddress": req.Wallet,
		"chainId":       req.ChainID,
	}

	if spender := findStringDeep(quotePayload, "permit2Address", "spender"); spender != "" {
		approvalReq["spender"] = spender
	}

	return c.postJSON(ctx, "check_approval", approvalReq)
}

func (c *uniswapClient) postJSON(ctx context.Context, path string, payload map[string]any) (map[string]any, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := c.baseURL + "/" + strings.TrimLeft(path, "/")
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &upstreamHTTPError{
			op:         path,
			statusCode: resp.StatusCode,
		}
	}

	var decoded map[string]any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return nil, err
	}

	return decoded, nil
}
