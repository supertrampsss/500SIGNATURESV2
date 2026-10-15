#!/bin/sh
webkit_runtime=/home/agent/.cache/ms-playwright/webkit-2336/minibrowser-wpe
export WEBKIT_EXEC_PATH="$webkit_runtime/bin"
export WEBKIT_INJECTED_BUNDLE_PATH="$webkit_runtime/lib"
export WEBKIT_INSPECTOR_RESOURCES_PATH="$webkit_runtime/share"
export LD_LIBRARY_PATH="$webkit_runtime/lib:$webkit_runtime/sys/lib:/workspace/mandats-browser-libs/extracted/usr/lib/x86_64-linux-gnu"
exec "$webkit_runtime/bin/MiniBrowser" "$@"
