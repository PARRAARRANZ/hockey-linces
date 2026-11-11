#!/usr/bin/env bash
# Ajustes del proyecto Android generado: horizontal, pantalla completa y version
set -e
M=android/app/src/main/AndroidManifest.xml
# solo en horizontal (gira con el sensor)
grep -q screenOrientation "$M" || sed -i "s/<activity\b/<activity android:screenOrientation=\"sensorLandscape\"/" "$M"
# pantalla completa, sin barra de estado
S=android/app/src/main/res/values/styles.xml
grep -q windowFullscreen "$S" || sed -i 's#<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">#&\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>#' "$S"
# numero de version a partir del numero de ejecucion de GitHub
if [ -n "$GITHUB_RUN_NUMBER" ]; then
  sed -i "s/versionCode 1$/versionCode $GITHUB_RUN_NUMBER/" android/app/build.gradle
fi
echo "Proyecto Android ajustado"
