import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function UnlockFileSystemsDialog({ pools, onRefresh }) {
    const Dialogs = useDialogs();
    const [poolName, setPoolName] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState({});
    const [unlocking, setUnlocking] = useState(false);

    const handleUnlock = async () => {
        setSubmitted(true);
        if (!poolName || !passphrase) {
            return;
        }

        setUnlocking(true);
        try {
            await ZfsApi.unlockFileSystems(poolName, passphrase);
            // Mount the filesystems after unlocking
            const mountProc = window.cockpit.spawn(['zfs', 'mount', '-a']);
            mountProc.done(() => {
                Dialogs.close();
                onRefresh();
            });
            mountProc.fail(() => {
                // Unlock succeeded but mount failed, still close dialog
                Dialogs.close();
                onRefresh();
            });
        } catch (exc) {
            setError({
                dialogError: `Failed to unlock file systems in pool ${poolName}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setUnlocking(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title="Unlock Encrypted File Systems" />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}
                    <FormGroup
                        label="Pool Name"
                        fieldId="unlock-pool"
                        validated={submitted && !poolName ? 'error' : 'default'}
                    >
                        <FormSelect
                            id="unlock-pool"
                            value={poolName}
                            onChange={(_, value) => setPoolName(value)}
                            validated={submitted && !poolName ? 'error' : 'default'}
                        >
                            <FormSelectOption value="" label="Select a pool..." />
                            {pools.map(pool => (
                                <FormSelectOption key={pool.name} value={pool.name} label={pool.name} />
                            ))}
                        </FormSelect>
                        <FormHelper
                            helperTextInvalid={(submitted && !poolName) ? "Pool name is required" : null}
                        />
                    </FormGroup>
                    <FormGroup
                        label="Passphrase"
                        fieldId="unlock-passphrase"
                        validated={submitted && !passphrase ? 'error' : 'default'}
                    >
                        <TextInput
                            id="unlock-passphrase"
                            type="password"
                            value={passphrase}
                            onChange={(_, value) => setPassphrase(value)}
                            validated={submitted && !passphrase ? 'error' : 'default'}
                        />
                        <FormHelper
                            helperTextInvalid={(submitted && !passphrase) ? "Passphrase is required" : null}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleUnlock}
                    isDisabled={unlocking}
                    isLoading={unlocking}
                >
                    Unlock
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={unlocking}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default UnlockFileSystemsDialog;

