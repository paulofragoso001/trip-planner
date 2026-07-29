import Capacitor
import Foundation
import XCTest

func makeSyncPluginCall(
    jsonString: String,
    onSuccess: @escaping ([String: Any]) -> Void
) -> CAPPluginCall {
    CAPPluginCall(
        callbackId: UUID().uuidString,
        methodName: "syncPayloadToNative",
        options: ["jsonString": jsonString],
        success: { result, _ in
            onSuccess(result?.data ?? [:])
        },
        error: { error in
            XCTFail("MapGateway plugin call failed: \(error?.message ?? "Unknown error")")
        }
    )
}
let syncPayloadFixture = """
{
  "revisionId": 1714312800000,
  "routeId": "rte_9f82c4",
  "status": "active",
  "trip": {
    "tripId": "trp_alpha_01",
    "origin": { "lat": 37.7749, "lng": -122.4194, "name": "SF Transit Hub" },
    "destination": { "lat": 34.0522, "lng": -118.2437, "name": "LA Terminal" }
  },
  "wallet": {
    "passId": "pass_wallet_881",
    "isPassInstalled": true,
    "balance": "42.50",
    "currency": "USD"
  },
  "camera": {
    "center": { "lat": 36.0, "lng": -120.0 },
    "altitude": 10000000.0,
    "pitch": 0.0,
    "heading": 0.0
  }
}
"""
