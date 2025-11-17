import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function ExportPoolDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [error, setError] = useState({});
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            await ZfsApi.exportPool(pool.name);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to export pool ${pool.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setExporting(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Export Pool ${pool.name}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}
                <p>
                    Are you sure you want to export pool <strong>{pool.name}</strong>?
                </p>
                <p>
                    The pool will be unmounted and made available for import on another system.
                </p>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="export-pool-dialog-confirm"
                    onClick={handleExport}
                    isLoading={exporting}
                >
                    Export Pool
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={exporting}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ExportPoolDialog;

