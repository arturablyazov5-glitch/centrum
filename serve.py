#!/usr/bin/env python3
"""Локальный сервер для CENTRUM: отдаёт файлы проекта и запрещает их кэшировать.

`python3 -m http.server` присылает Last-Modified без Cache-Control. Браузер в этом
случае кэширует по эвристике, и при правке страница подтягивает часть ES-модулей
новыми, а часть — старыми: получается ошибка вида «модуль не экспортирует X».
Здесь кэш выключен явно, поэтому обычной перезагрузки всегда достаточно.

    python3 serve.py [порт]        # по умолчанию 8000
"""

import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # В консоли нужны только ошибки: успешные запросы к чертежам её забивают.
        if not str(args[1] if len(args) > 1 else '').startswith('2'):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    print(f'CENTRUM → http://localhost:{PORT}/centrum.html   (кэш выключен, Ctrl+C — остановить)')
    try:
        HTTPServer(('127.0.0.1', PORT), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        print('\nостановлен')
