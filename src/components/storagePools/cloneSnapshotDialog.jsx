import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function CloneSnapshotDialog({ snapshot, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [cloneName, setCloneName] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState({});
    const [cloning, setCloning] = useState(false);

    const handleClone = async () => {
        setSubmitted(true);
        if (!cloneName || !cloneName.trim()) {
            return;
        }

        setCloning(true);
        try {
            await ZfsApi.cloneSnapshot(snapshot.name, cloneName.trim());
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to clone snapshot ${snapshot.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setCloning(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Clone Snapshot ${snapshot.name}`} />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}
                    <FormGroup label="Clone Name" fieldId="clone-snapshot-name">
                        <TextInput
                            id="clone-snapshot-name"
                            validated={submitted && !cloneName ? "error" : "default"}
                            value={cloneName}
                            onChange={(_, value) => setCloneName(value)}
                            placeholder="New file system name"
                        />
                        <FormHelper
                            helperTextInvalid={(submitted && !cloneName) ? "Clone name must not be empty" : null}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleClone}
                    isDisabled={cloning}
                    isLoading={cloning}
                >
                    Clone
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={cloning}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default CloneSnapshotDialog;

