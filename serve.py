#!/usr/bin/env python3
"""Локальный сервер для CENTRUM: отдаёт файлы проекта и запрещает их кэшировать.

`python3 -m http.server` присылает Last-Modified без Cache-Control. Браузер в этом
случае кэширует по эвристике, и при правке страница подтягивает часть ES-модулей
новыми, а часть — старыми: получается ошибка вида «модуль не экспортирует X».
Здесь кэш выключен явно, поэтому обычной перезагрузки всегда достаточно.

    python3 serve.py [порт]        # по умолчанию 8000
"""

import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Server(ThreadingHTTPServer):
    # По умолчанию очередь соединений — 5. Конфигуратор разом запрашивает десятки
    # ES-модулей, лишние соединения macOS сбрасывает (ERR_CONNECTION_RESET), и один
    # недогруженный модуль оставляет страницу на «Загрузка конфигуратора…».
    request_queue_size = 256
    daemon_threads = True


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Страницы, закэшированные прежним http.server, браузер берёт без запроса
        # к серверу, и no-store до них не доходит. При загрузке страницы кэш сайта
        # очищается целиком: iframe конфигуратора тоже получает свежий HTML.
        if self.path.split('?')[0].endswith(('/', '.html')):
            self.send_header('Clear-Site-Data', '"cache"')
        super().end_headers()

    def log_message(self, fmt, *args):
        # В консоли нужны только ошибки: успешные запросы к чертежам её забивают.
        if not str(args[1] if len(args) > 1 else '').startswith('2'):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    print(f'CENTRUM → http://localhost:{PORT}/centrum.html   (кэш выключен, Ctrl+C — остановить)')
    # Потоковый сервер: иначе текстуры и модели по несколько мегабайт идут строго
    # по очереди и сцена секунды висит без текстур, в светлых цветах-метках.
    try:
        Server(('127.0.0.1', PORT), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        print('\nостановлен')
