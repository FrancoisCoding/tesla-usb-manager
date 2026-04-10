interface Props {
  onClose: () => void;
  onConfirm?: () => void;
}

export default function SafetyModal({ onClose, onConfirm }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-title">Safety Confirmation<br />Required</div>
        <div className="modal-desc">
          You are about to initiate a drive format on <strong>Tesla USB Manager</strong>.<br />
          This action is irreversible.
        </div>
        <div className="modal-warning">
          <div className="modal-warning-icon">●</div>
          <div>
            <div className="modal-warning-label">Destructive Action</div>
            <div className="modal-warning-text">
              All Dashcam footage, Sentry Mode clips, and custom music libraries will be{" "}
              <span className="text-accent text-strike">permanently erased</span>. Data recovery is not possible after this operation.
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => { onConfirm?.(); onClose(); }}>
            Confirm Format
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-footer">
          <span>128GB STORAGE</span>
          <span>V1.0 ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
