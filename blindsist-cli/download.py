#!/usr/bin/env python3
"""
Download YOLOv5n.pt correctly (handles GitHub redirects)
Run this ONCE with internet, then copy yolov5n.pt to your project folder.
"""
import os
import sys
import urllib.request
import ssl

# Disable SSL verification for GitHub (safe for this use)
ssl._create_default_https_context = ssl._create_unverified_context

OUTPUT_FILE = "yolov5n.pt"
URL = "https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5n.pt"
EXPECTED_SIZE = 7_000_000  # ~7 MB

def download_with_progress(url, filename):
    print(f"⬇️  Downloading: {url}")
    print(f"📁 Saving to: {os.path.abspath(filename)}")
    print()
    
    try:
        # Use urlopen which follows redirects properly
        with urllib.request.urlopen(url, timeout=30) as response:
            total_size = int(response.headers.get('Content-Length', 0))
            downloaded = 0
            block_size = 8192
            
            with open(filename, 'wb') as f:
                while True:
                    buffer = response.read(block_size)
                    if not buffer:
                        break
                    f.write(buffer)
                    downloaded += len(buffer)
                    
                    # Show progress
                    if total_size:
                        percent = downloaded / total_size * 100
                        print(f"\r   Progress: {percent:5.1f}% ({downloaded//1024} KB / {total_size//1024} KB)", end='')
                    else:
                        print(f"\r   Downloaded: {downloaded//1024} KB", end='')
                    sys.stdout.flush()
            
            print("\n")
            
        # Verify
        actual_size = os.path.getsize(filename)
        print(f"✅ Download complete!")
        print(f"📦 File size: {actual_size//1024} KB ({actual_size/1024/1024:.1f} MB)")
        
        if actual_size < EXPECTED_SIZE * 0.8:
            print(f"❌ WARNING: File seems too small! Expected ~{EXPECTED_SIZE//1024//1024} MB")
            print(f"💡 The download may have failed. Try again.")
            return False
        else:
            print(f"✅ File size looks correct!")
            return True
            
    except Exception as e:
        print(f"\n❌ Download failed: {e}")
        if os.path.exists(filename):
            os.remove(filename)
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("📦 YOLOv5n.pt Downloader")
    print("=" * 60)
    print()
    
    if os.path.exists(OUTPUT_FILE):
        print(f"⚠️  {OUTPUT_FILE} already exists. Delete it to re-download.")
        print(f"   Current size: {os.path.getsize(OUTPUT_FILE)//1024} KB")
        print()
    
    success = download_with_progress(URL, OUTPUT_FILE)
    
    print()
    if success:
        print("🎉 Success! You can now:")
        print(f"   1. Keep {OUTPUT_FILE} in this folder, OR")
        print(f"   2. Copy it to your project folder")
        print(f"   3. Run your detector offline!")
    else:
        print("💡 If download keeps failing, try:")
        print("   - Using a different network")
        print("   - Downloading via browser: right-click link → Save As")
        print("   - Using: pip install ultralytics && yolo download model=yolov5n.pt")
    
    print()
    input("Press Enter to exit...")