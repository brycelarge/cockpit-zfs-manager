import React, { useState, useEffect } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { HelpIcon } from '@patternfly/react-icons';

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function PoolPropertiesDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [properties, setProperties] = useState({});
    const [formValues, setFormValues] = useState({});
    const [error, setError] = useState({});

    useEffect(() => {
        loadProperties();
    }, [pool.name]);

    const loadProperties = async () => {
        setLoading(true);
        try {
            const [props, version] = await Promise.all([
                ZfsApi.getPoolProperties(pool.name),
                ZfsApi.getPoolVersion(pool.name).catch(() => null)
            ]);
            setProperties(props);
            
            // Store version in properties for display
            if (version !== null) {
                props.version = { value: version.toString() };
            }
            
            // Initialize form values with current property values
            setFormValues({
                comment: props.comment?.value || '',
                autoreplace: props.autoreplace?.value === 'on',
                autotrim: props.autotrim?.value === 'on',
                bootfs: props.bootfs?.value || '',
                cachefile: props.cachefile?.value || '',
                failmode: props.failmode?.value || 'wait',
                readonly: props.readonly?.value === 'on',
                delegation: props.delegation?.value === 'on',
                listsnapshots: props.listsnapshots?.value === 'on'
            });
        } catch (exc) {
            setError({
                dialogError: 'Failed to load pool properties',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError({});

        try {
            const updates = [];
            
            // Comment
            if (formValues.comment !== (properties.comment?.value || '')) {
                const commentValue = formValues.comment.trim() || '';
                updates.push(ZfsApi.setPoolProperty(pool.name, 'comment', commentValue));
            }
            
            // Auto-replace
            const autoreplaceValue = formValues.autoreplace ? 'on' : 'off';
            if (autoreplaceValue !== properties.autoreplace?.value) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'autoreplace', autoreplaceValue));
            }
            
            // Auto-trim
            const autotrimValue = formValues.autotrim ? 'on' : 'off';
            if (autotrimValue !== properties.autotrim?.value) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'autotrim', autotrimValue));
            }
            
            // Boot filesystem
            if (formValues.bootfs !== (properties.bootfs?.value || '')) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'bootfs', formValues.bootfs.trim()));
            }
            
            // Cache file
            if (formValues.cachefile !== (properties.cachefile?.value || '')) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'cachefile', formValues.cachefile.trim()));
            }
            
            // Fail mode
            if (formValues.failmode !== properties.failmode?.value) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'failmode', formValues.failmode));
            }
            
            // Read-only
            const readonlyValue = formValues.readonly ? 'on' : 'off';
            if (readonlyValue !== properties.readonly?.value) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'readonly', readonlyValue));
            }
            
            // Delegation
            const delegationValue = formValues.delegation ? 'on' : 'off';
            if (delegationValue !== properties.delegation?.value) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'delegation', delegationValue));
            }
            
            // List snapshots
            const listsnapshotsValue = formValues.listsnapshots ? 'on' : 'off';
            if (listsnapshotsValue !== properties.listsnapshots?.value) {
                updates.push(ZfsApi.setPoolProperty(pool.name, 'listsnapshots', listsnapshotsValue));
            }

            await Promise.all(updates);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to save properties',
                dialogErrorDetail: exc.message || String(exc)
            });
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
                <ModalHeader title={`Properties: ${pool.name}`} />
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading properties" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Properties: ${pool.name}`} />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}

                    <FormGroup
                        label="Pool Version"
                        fieldId="version"
                    >
                        <TextInput
                            id="version"
                            value={properties.version?.value || 'Unknown'}
                            isReadOnly
                            style={{ backgroundColor: 'var(--pf-t--global--palette--black-150)' }}
                        />
                        <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                            Use "Upgrade Pool" from the actions menu to upgrade the pool version.
                        </div>
                    </FormGroup>

                    <FormGroup
                        label="Comment"
                        fieldId="comment"
                        helperText="Optional comment or description for this pool"
                    >
                        <TextInput
                            id="comment"
                            value={formValues.comment}
                            onChange={(_, value) => setFormValues({ ...formValues, comment: value })}
                            placeholder="Pool description"
                        />
                    </FormGroup>

                    <FormGroup
                        label={
                            <span>
                                Auto-Replace
                                <Tooltip content="Automatically replace devices with spare devices when they fail">
                                    <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                        <HelpIcon />
                                    </span>
                                </Tooltip>
                            </span>
                        }
                        fieldId="autoreplace"
                    >
                        <Checkbox
                            id="autoreplace"
                            label="Enable automatic device replacement"
                            isChecked={formValues.autoreplace}
                            onChange={(_, checked) => setFormValues({ ...formValues, autoreplace: checked })}
                        />
                    </FormGroup>

                    <FormGroup
                        label={
                            <span>
                                Auto-Trim
                                <Tooltip content="Automatically trim unused space on SSDs">
                                    <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                        <HelpIcon />
                                    </span>
                                </Tooltip>
                            </span>
                        }
                        fieldId="autotrim"
                    >
                        <Checkbox
                            id="autotrim"
                            label="Enable automatic TRIM"
                            isChecked={formValues.autotrim}
                            onChange={(_, checked) => setFormValues({ ...formValues, autotrim: checked })}
                        />
                    </FormGroup>

                    <FormGroup
                        label="Boot Filesystem"
                        fieldId="bootfs"
                        helperText="Default boot filesystem for this pool"
                    >
                        <TextInput
                            id="bootfs"
                            value={formValues.bootfs}
                            onChange={(_, value) => setFormValues({ ...formValues, bootfs: value })}
                            placeholder="none"
                        />
                    </FormGroup>

                    <FormGroup
                        label="Cache File"
                        fieldId="cachefile"
                        helperText="Path to cache file for pool configuration"
                    >
                        <TextInput
                            id="cachefile"
                            value={formValues.cachefile}
                            onChange={(_, value) => setFormValues({ ...formValues, cachefile: value })}
                            placeholder="default"
                        />
                    </FormGroup>

                    <FormGroup
                        label={
                            <span>
                                Fail Mode
                                <Tooltip content="Behavior when all top-level virtual devices are unavailable">
                                    <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                        <HelpIcon />
                                    </span>
                                </Tooltip>
                            </span>
                        }
                        fieldId="failmode"
                    >
                        <FormSelect
                            id="failmode"
                            value={formValues.failmode}
                            onChange={(_, value) => setFormValues({ ...formValues, failmode: value })}
                        >
                            <FormSelectOption value="wait" label="Wait (default)" />
                            <FormSelectOption value="continue" label="Continue" />
                            <FormSelectOption value="panic" label="Panic" />
                        </FormSelect>
                    </FormGroup>

                    <FormGroup
                        label="Read-Only"
                        fieldId="readonly"
                    >
                        <Checkbox
                            id="readonly"
                            label="Make pool read-only"
                            isChecked={formValues.readonly}
                            onChange={(_, checked) => setFormValues({ ...formValues, readonly: checked })}
                        />
                    </FormGroup>

                    <FormGroup
                        label="Delegation"
                        fieldId="delegation"
                    >
                        <Checkbox
                            id="delegation"
                            label="Enable ZFS delegation"
                            isChecked={formValues.delegation}
                            onChange={(_, checked) => setFormValues({ ...formValues, delegation: checked })}
                        />
                    </FormGroup>

                    <FormGroup
                        label="List Snapshots"
                        fieldId="listsnapshots"
                    >
                        <Checkbox
                            id="listsnapshots"
                            label="Include snapshots in zfs list output"
                            isChecked={formValues.listsnapshots}
                            onChange={(_, checked) => setFormValues({ ...formValues, listsnapshots: checked })}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    isDisabled={saving}
                    isLoading={saving}
                >
                    Save Properties
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={saving}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default PoolPropertiesDialog;

