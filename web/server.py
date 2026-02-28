from http.server import HTTPServer, SimpleHTTPRequestHandler
class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        SimpleHTTPRequestHandler.end_headers(self)
HTTPServer(('localhost', 8008), CORSRequestHandler).serve_forever()
