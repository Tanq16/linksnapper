# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git curl make

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

ARG VERSION=dev-build

# Download assets and build
RUN make assets && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X 'github.com/tanq16/linksnapper/cmd.AppVersion=${VERSION}'" -o linksnapper .

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app

COPY --from=builder /app/linksnapper .

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 8080
ENTRYPOINT ["./linksnapper"]
CMD ["serve", "-d", "/app/data", "-H", "0.0.0.0"]
