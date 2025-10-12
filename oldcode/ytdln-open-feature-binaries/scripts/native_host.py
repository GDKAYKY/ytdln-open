import sys
import json
import struct
import subprocess
import re

# This function reads a message from stdin and decodes it.
def get_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

# This function encodes a message and sends it to stdout.
def send_message(message):
    encoded_content = json.dumps(message).encode('utf-8')
    encoded_length = struct.pack('@I', len(encoded_content))
    sys.stdout.buffer.write(encoded_length)
    sys.stdout.buffer.write(encoded_content)
    sys.stdout.buffer.flush()

# This function runs yt-dlp and sends progress updates.
def download_video(url, use_aria2c):
    command = [
        'yt-dlp',
        '--progress',
        '--newline',
        '-o',
        '~/Downloads/%(title)s.%(ext)s', # Save to user's Downloads folder
    ]

    if use_aria2c:
        command.extend(['--downloader', 'aria2c'])
    
    command.append(url)

    try:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)

        for line in process.stdout:
            line = line.strip()
            # yt-dlp progress format is like: '[download] 10.5% of 12.34MiB at 1.23MiB/s ETA 00:08'
            match = re.search(r'\[download\]\s+([\d\.]+)\%', line)
            if match:
                progress = float(match.group(1))
                send_message({'status': 'progress', 'progress': progress})

        process.wait()

        if process.returncode == 0:
            send_message({'status': 'success'})
        else:
            error_output = process.stderr.read()
            send_message({'status': 'error', 'message': error_output})

    except FileNotFoundError:
        send_message({'status': 'error', 'message': 'yt-dlp or aria2c not found. Please ensure they are installed and in your system's PATH.'})
    except Exception as e:
        send_message({'status': 'error', 'message': str(e)})

# Main loop
while True:
    try:
        request = get_message()
        download_video(request.get('url'), request.get('use_aria2c'))
    except Exception as e:
        send_message({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'})
        sys.exit(1)