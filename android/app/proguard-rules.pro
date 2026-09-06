# Preserve line number information & annotations for Play Console crash symbolication
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# Preserve Javascript interfaces used by WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve Capacitor Bridge, core engine, and plugin reflections
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}
-keep class * extends com.getcapacitor.BridgeActivity { *; }
-keep @interface com.getcapacitor.annotation.CapacitorPlugin { *; }

# Preserve local HisaabPro application plugins and native components
-keep class com.hisaabpro.app.** { *; }
-keepclassmembers class com.hisaabpro.app.** { *; }

# Preserve Google Play Services Phone Number Hint & Identity APIs
-keep class com.google.android.gms.auth.api.identity.** { *; }
-keepclassmembers class com.google.android.gms.auth.api.identity.** { *; }
-keep class com.google.android.gms.common.api.** { *; }

# Keep AndroidX classes used by Capacitor
-keep class androidx.** { *; }
-dontwarn androidx.**

# Keep WebView
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
    public void *(android.webkit.WebView, java.lang.String);
}

# Suppress harmless warnings from optional transitive dependencies
-dontwarn com.google.android.gms.**
-dontwarn com.getcapacitor.**

