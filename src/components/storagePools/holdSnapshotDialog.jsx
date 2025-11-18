import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function HoldSnapshotDialog({ snapshot, onRefresh }) {
    const Dialogs = useDialogs();
    const [tag, setTag] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState({});
    const [holding, setHolding] = useState(false);

    const handleHold = async () => {
        setSubmitted(true);

        if (!tag || tag.trim() === '') {
            setError({
                dialogError: 'Tag is required',
                dialogErrorDetail: 'Please enter a tag name for the hold'
            });
            return;
        }

        // Validate tag: must be alphanumeric, underscore, hyphen, or colon
        const tagRegex = /^[a-zA-Z0-9_\-:]+$/;
        if (!tagRegex.test(tag.trim())) {
            setError({
                dialogError: 'Invalid tag format',
                dialogErrorDetail: 'Tag can only contain letters, numbers, underscores, hyphens, and colons'
            });
            return;
        }

        setHolding(true);
        setError({});
        try {
            await ZfsApi.holdSnapshot(snapshot.name, tag.trim());
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to hold snapshot ${snapshot.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setHolding(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Hold Snapshot ${snapshot.name}`} />
            <ModalBody>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleHold();
                    }}
                    isHorizontal
                >
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}
                    
                    <Alert variant="info" title="About Holds" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                        <p>
                            A hold prevents a snapshot from being deleted. The snapshot cannot be destroyed until all holds are released.
                        </p>
                    </Alert>

                    <FormGroup label="Hold Tag" fieldId="hold-tag" isRequired>
                        <TextInput
                            id="hold-tag"
                            validated={submitted && !tag ? "error" : "default"}
                            value={tag}
                            onChange={(_, value) => {
                                setTag(value);
                                if (error.dialogError) {
                                    setError({});
                                }
                            }}
                            placeholder="e.g., backup-2024-01-01"
                        />
                        <FormHelper
                            helperText="Enter a tag name to identify this hold. Common tags: backup, archive, retention"
                            helperTextInvalid={(submitted && !tag) ? "Tag is required" : null}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="hold-snapshot-dialog-confirm"
                    onClick={handleHold}
                    isDisabled={holding}
                    isLoading={holding}
                >
                    Hold Snapshot
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={holding}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default HoldSnapshotDialog;

