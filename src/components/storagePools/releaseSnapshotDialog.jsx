import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function ReleaseSnapshotDialog({ snapshot, hold, onRefresh }) {
    const Dialogs = useDialogs();
    const [error, setError] = useState({});
    const [releasing, setReleasing] = useState(false);

    const handleRelease = async () => {
        setReleasing(true);
        setError({});
        try {
            await ZfsApi.releaseSnapshot(snapshot.name, hold.tag);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to release hold ${hold.tag} from snapshot ${snapshot.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setReleasing(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Release Hold ${hold.tag}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}
                
                <Alert variant="info" title="Release Hold" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        This will release the hold <strong>{hold.tag}</strong> from snapshot <strong>{snapshot.name}</strong>.
                        The snapshot can then be deleted if no other holds exist.
                    </p>
                </Alert>

                <DescriptionList isHorizontal>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Snapshot</DescriptionListTerm>
                        <DescriptionListDescription>{snapshot.name}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Hold Tag</DescriptionListTerm>
                        <DescriptionListDescription>{hold.tag}</DescriptionListDescription>
                    </DescriptionListGroup>
                    {hold.timestamp && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>Created</DescriptionListTerm>
                            <DescriptionListDescription>{hold.timestamp}</DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                </DescriptionList>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="release-hold-dialog-confirm"
                    onClick={handleRelease}
                    isDisabled={releasing}
                    isLoading={releasing}
                >
                    Release Hold
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={releasing}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ReleaseSnapshotDialog;

