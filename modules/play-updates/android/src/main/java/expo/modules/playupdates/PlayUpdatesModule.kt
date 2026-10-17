package expo.modules.playupdates

import android.app.Activity
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google Play's flexible in-app update flow, and nothing more.
 *
 * Play shows its own "update available" prompt; the update then downloads in
 * the background while the app stays usable. The app is never restarted from
 * here: once the download finishes the JavaScript side asks the user, and only
 * `completeUpdate` installs and restarts.
 *
 * A failed check (for example an install that did not come from Play) resolves
 * as "unknown" rather than rejecting, so callers never have to handle it.
 */
class PlayUpdatesModule : Module() {
  private var manager: AppUpdateManager? = null

  private val listener = InstallStateUpdatedListener { state ->
    sendEvent(EVENT_STATUS, mapOf("status" to installStatusName(state.installStatus())))
  }

  override fun definition() = ModuleDefinition {
    Name("PlayUpdates")

    Events(EVENT_STATUS)

    OnCreate {
      manager = appContext.reactContext?.let { AppUpdateManagerFactory.create(it) }
      manager?.registerListener(listener)
    }

    OnDestroy {
      manager?.unregisterListener(listener)
    }

    AsyncFunction("getUpdateState") { promise: Promise ->
      val updates = manager ?: return@AsyncFunction promise.resolve(UNKNOWN_STATE)
      updates.appUpdateInfo
        .addOnSuccessListener { info -> promise.resolve(describe(info)) }
        .addOnFailureListener { promise.resolve(UNKNOWN_STATE) }
    }

    AsyncFunction("startFlexibleUpdate") { promise: Promise ->
      val updates = manager ?: return@AsyncFunction promise.resolve(false)
      updates.appUpdateInfo
        .addOnSuccessListener { info ->
          val activity = appContext.currentActivity
          if (
            activity == null ||
            info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
            !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
          ) {
            promise.resolve(false)
            return@addOnSuccessListener
          }
          val started = try {
            updates.startUpdateFlowForResult(
              info,
              activity,
              AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
              REQUEST_CODE
            )
          } catch (error: Exception) {
            false
          }
          promise.resolve(started)
        }
        .addOnFailureListener { promise.resolve(false) }
    }

    AsyncFunction("completeUpdate") { promise: Promise ->
      manager?.completeUpdate()
      promise.resolve(null)
    }

    OnActivityResult { _, result ->
      if (result.requestCode == REQUEST_CODE) {
        val status = if (result.resultCode == Activity.RESULT_OK) "accepted" else "declined"
        sendEvent(EVENT_STATUS, mapOf("status" to status))
      }
    }
  }

  private fun describe(info: AppUpdateInfo): Map<String, Any?> = mapOf(
    "availability" to when (info.updateAvailability()) {
      UpdateAvailability.UPDATE_AVAILABLE -> "available"
      UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "inProgress"
      UpdateAvailability.UPDATE_NOT_AVAILABLE -> "none"
      else -> "unknown"
    },
    "installStatus" to installStatusName(info.installStatus()),
    "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
    "stalenessDays" to info.clientVersionStalenessDays(),
  )

  private fun installStatusName(status: Int): String = when (status) {
    InstallStatus.PENDING -> "pending"
    InstallStatus.DOWNLOADING -> "downloading"
    InstallStatus.DOWNLOADED -> "downloaded"
    InstallStatus.INSTALLING -> "installing"
    InstallStatus.INSTALLED -> "installed"
    InstallStatus.FAILED -> "failed"
    InstallStatus.CANCELED -> "canceled"
    else -> "unknown"
  }

  companion object {
    private const val EVENT_STATUS = "onStatusChange"
    private const val REQUEST_CODE = 7311
    private val UNKNOWN_STATE = mapOf(
      "availability" to "unknown",
      "installStatus" to "unknown",
      "flexibleAllowed" to false,
      "stalenessDays" to null,
    )
  }
}
