use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;

use execution::http_response;

fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "9002".to_string());
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .unwrap_or_else(|err| panic!("failed to bind execution service: {err}"));

    println!("execution service listening on 127.0.0.1:{port}");

    for stream in listener.incoming() {
        let Ok(mut stream) = stream else {
            continue;
        };

        let mut buffer = [0_u8; 1024];
        let Ok(bytes_read) = stream.read(&mut buffer) else {
            continue;
        };
        if bytes_read == 0 {
            continue;
        }

        let request = String::from_utf8_lossy(&buffer[..bytes_read]);
        let request_line = request.lines().next().unwrap_or_default();
        let (status_code, body) = http_response(request_line);
        let status_text = if status_code == 200 {
            "OK"
        } else {
            "Not Found"
        };

        let response = format!(
            "HTTP/1.1 {status_code} {status_text}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );

        let _ = stream.write_all(response.as_bytes());
    }
}
