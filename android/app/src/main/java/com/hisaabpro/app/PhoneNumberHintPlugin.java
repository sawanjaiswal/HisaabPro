package com.hisaabpro.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.SignInClient;

/**
 * Google Play Services Phone Number Hint.
 *
 * One-tap sheet listing the phone numbers on the device's own SIMs. No runtime
 * permission is required (READ_PHONE_STATE / READ_PHONE_NUMBERS are NOT declared
 * in the manifest and must not be): Play Services owns the picker and the user's
 * consent, and the app only ever receives the number the user tapped.
 */
@CapacitorPlugin(name = "PhoneNumberHint")
public class PhoneNumberHintPlugin extends Plugin {

    private static final String REASON_UNAVAILABLE = "unavailable";
    private static final String REASON_CANCELLED = "cancelled";

    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pendingCall;

    @Override
    public void load() {
        Activity activity = getActivity();
        if (!(activity instanceof ComponentActivity)) {
            return;
        }
        launcher =
            ((ComponentActivity) activity).getActivityResultRegistry()
                .register(
                    "hp_phone_number_hint",
                    new ActivityResultContracts.StartIntentSenderForResult(),
                    this::onHintResult
                );
    }

    private void resolveNumber(PluginCall call, String phoneNumber) {
        JSObject ret = new JSObject();
        ret.put("phoneNumber", phoneNumber);
        call.resolve(ret);
    }

    private void resolveEmpty(PluginCall call, String reason) {
        JSObject ret = new JSObject();
        ret.put("phoneNumber", JSObject.NULL);
        ret.put("reason", reason);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPhoneNumber(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null || launcher == null) {
            resolveEmpty(call, REASON_UNAVAILABLE);
            return;
        }
        if (pendingCall != null) {
            resolveEmpty(call, REASON_CANCELLED);
            return;
        }
        GetPhoneNumberHintIntentRequest request = GetPhoneNumberHintIntentRequest.builder().build();
        SignInClient client = Identity.getSignInClient(activity);
        client
            .getPhoneNumberHintIntent(request)
            .addOnSuccessListener(
                (PendingIntent pendingIntent) -> {
                    try {
                        pendingCall = call;
                        launcher.launch(new IntentSenderRequest.Builder(pendingIntent).build());
                    } catch (Exception e) {
                        pendingCall = null;
                        resolveEmpty(call, REASON_UNAVAILABLE);
                    }
                }
            )
            .addOnFailureListener(e -> resolveEmpty(call, REASON_UNAVAILABLE));
    }

    private void onHintResult(androidx.activity.result.ActivityResult result) {
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call == null) {
            return;
        }
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            resolveEmpty(call, REASON_CANCELLED);
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            resolveEmpty(call, REASON_UNAVAILABLE);
            return;
        }
        try {
            String phoneNumber = Identity.getSignInClient(activity).getPhoneNumberFromIntent(data);
            if (phoneNumber == null || phoneNumber.isEmpty()) {
                resolveEmpty(call, REASON_CANCELLED);
                return;
            }
            resolveNumber(call, phoneNumber);
        } catch (Exception e) {
            resolveEmpty(call, REASON_CANCELLED);
        }
    }
}
