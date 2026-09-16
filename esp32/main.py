import utime
import urequests
import json
import network
from machine import I2C, Pin
from mpu6500 import MPU6500

URL = "http://10.149.34.32:6767"
HEADERS = {"Content-Type": "application/json"}
SSID = "abiot"
PASSWORD = "wachtwoord"

# --- Robust Wi-Fi Connection Function ---
def connect_wifi(ssid, password, timeout_s=15):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if not wlan.isconnected():
        print(f"Connecting to {ssid}...")
        wlan.connect(ssid, password)
        
        start_time = utime.time()
        # Wait for connection AND a valid IP address
        while not wlan.isconnected() or wlan.ifconfig()[0] == '0.0.0.0':
            if utime.time() - start_time > timeout_s:
                raise RuntimeError("Wi-Fi connection timed out")
            utime.sleep_ms(250)
            
    print("Connected! Network config:", wlan.ifconfig())
    return wlan

wlan = connect_wifi(SSID, PASSWORD)

# --- Sensor Initialization ---
i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)
sensor = MPU6500(i2c)
print("Calibrating sensor...")
sensor.calibrate()
print("Calibration complete.")

# --- Main Transmission Loop ---
while True:
    # 1. Ensure Wi-Fi is still alive; reconnect if dropped
    if not wlan.isconnected():
        print("Wi-Fi lost. Reconnecting...")
        try:
            connect_wifi(SSID, PASSWORD)
        except Exception as e:
            print("Reconnection failed:", e)
            utime.sleep(2)
            continue

    # 2. Read sensor once to avoid 6 redundant I2C roundtrips
    acc = sensor.acceleration
    gyro = sensor.gyro

    payload = {
        "acc": {"x": acc[0], "y": acc[1], "z": acc[2]},
        "gyro": {"x": gyro[0], "y": gyro[1], "z": gyro[2]}
    }

    # 3. HTTP POST with guaranteed socket cleanup
    response = None
    try:
        # Note: timeout parameter in urequests is in seconds, not milliseconds
        response = urequests.post(URL, data=json.dumps(payload), headers=HEADERS, timeout=3)
    except Exception as e:
        print("Error sending data:", e)
    finally:
        if response is not None:
            response.close()

    utime.sleep_ms(200)
