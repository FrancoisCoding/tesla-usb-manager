interface DriveInfo {
  displayName: string;
  mountPath: string;
  totalBytes: number | null;
}

interface Props {
  onClose: () => void;
  onConfirm?: () => void;
  drive?: DriveInfo | null;
}

export default function SafetyModal({ onClose, onConfirm, drive }: Props) {
  const sizeGb = drive?.totalBytes != null ? Math.round(drive.totalBytes / 1024 / 1024 / 1024) : null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-title">Safety Confirmation<br />Required</div>
        <div className="modal-desc">
          You are about to configure{" "}
          <strong>{drive ? drive.displayName + "(" + drive.mountPath + ")" : "the selected drive"}</strong>
          {sizeGb != null ? " - " + sizeGb + " GB" : ""}.<br />
          Confirm the drive path before writing Tesla media folders.
        </div>
        <div className="modal-warning">
          <div className="modal-warning-icon">●</div>
          <div>
            <div className="modal-warning-label">Drive Write</div>
            <div className="modal-warning-text">
              Tesla USB Manager will create missing media folders on the selected drive. It will not remove existing files during this step.
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => { onConfirm?.(); onClose(); }}>
            Confirm &amp; Apply
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-footer">
          <span>{sizeGb != null ? sizeGb + "GB STORAGE" : "128GB STORAGE"}</span>
          <span>V1.0 ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
