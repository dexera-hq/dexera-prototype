pub fn http_response(request_line: &str) -> (u16, String) {
    if request_line.starts_with("GET /health ") {
        return (
            200,
            "{\"status\":\"ok\",\"service\":\"market-data\"}".to_string(),
        );
    }
    if request_line.starts_with("GET /ping ") {
        return (
            200,
            "{\"message\":\"pong\",\"service\":\"market-data\"}".to_string(),
        );
    }
    (404, "{\"error\":\"not found\"}".to_string())
}

#[cfg(test)]
mod tests {
    use super::http_response;

    #[test]
    fn health_route_returns_ok() {
        let (status, body) = http_response("GET /health HTTP/1.1");
        assert_eq!(status, 200);
        assert!(body.contains("market-data"));
    }

    #[test]
    fn ping_route_returns_pong() {
        let (status, body) = http_response("GET /ping HTTP/1.1");
        assert_eq!(status, 200);
        assert!(body.contains("pong"));
    }

    #[test]
    fn unknown_route_returns_404() {
        let (status, _) = http_response("GET /unknown HTTP/1.1");
        assert_eq!(status, 404);
    }
}
