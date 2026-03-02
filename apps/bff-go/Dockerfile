FROM golang:1.26-alpine AS build

WORKDIR /src/apps/bff-go

# Copy module file first for better build cache behavior.
COPY apps/bff-go/go.mod ./
RUN go mod download

COPY apps/bff-go/. ./

ARG TARGETOS=linux
ARG TARGETARCH=amd64

RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/bff ./cmd/bff

FROM alpine:3.22 AS runtime

RUN apk add --no-cache ca-certificates wget && \
    addgroup -S app && \
    adduser -S -u 10001 -G app app

WORKDIR /app

COPY --from=build /out/bff /app/bff

ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

USER app

ENTRYPOINT ["/app/bff"]
