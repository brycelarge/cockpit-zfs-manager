import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function UpgradePoolDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [currentVersion, setCurrentVersion] = useState(null);
    const [availableVersions, setAvailableVersions] = useState([]);
    const [error, setError] = useState({});
    const [confirmIrreversible, setConfirmIrreversible] = useState(false);

    useEffect(() => {
        loadVersionInfo();
    }, [pool.name]);

    const loadVersionInfo = async () => {
        setLoading(true);
        setError({});
        try {
            const [version, versions] = await Promise.all([
                ZfsApi.getPoolVersion(pool.name),
                ZfsApi.getAvailableUpgradeVersions()
            ]);
            setCurrentVersion(version);
            setAvailableVersions(versions);
            
            // Filter to show only versions higher than current
            const upgradeableVersions = versions.filter(v => v.version > (version || 0));
            setAvailableVersions(upgradeableVersions);
        } catch (exc) {
            setError({
                dialogError: 'Failed to load version information',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        if (!confirmIrreversible) {
            setError({
                dialogError: 'Confirmation required',
                dialogErrorDetail: 'Please confirm that you understand this upgrade is irreversible'
            });
            return;
        }

        setUpgrading(true);
        setError({});
        try {
            await ZfsApi.upgradePool(pool.name);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to upgrade pool ${pool.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setUpgrading(false);
        }
    };

    const maxAvailableVersion = availableVersions.length > 0 
        ? Math.max(...availableVersions.map(v => v.version))
        : null;
    const canUpgrade = maxAvailableVersion && maxAvailableVersion > (currentVersion || 0);

    if (loading) {
        return (
            <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading version information" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Upgrade Pool: ${pool.name}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}

                <Alert variant="warning" title="Irreversible Operation" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        Pool upgrades are <strong>irreversible</strong>. Once upgraded, the pool cannot be downgraded to a previous version.
                        Older ZFS systems may not be able to import pools with newer versions.
                    </p>
                </Alert>

                <DescriptionList isHorizontal style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Current Version</DescriptionListTerm>
                        <DescriptionListDescription>
                            {currentVersion !== null ? `Version ${currentVersion}` : 'Unknown'}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Available Upgrade</DescriptionListTerm>
                        <DescriptionListDescription>
                            {canUpgrade ? `Upgrade to Version ${maxAvailableVersion}` : 'No upgrade available'}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>

                {canUpgrade && availableVersions.length > 0 && (
                    <>
                        <h4>New Features Available:</h4>
                        <ul style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                            {availableVersions.map(version => (
                                <li key={version.version}>
                                    <strong>Version {version.version}:</strong> {version.description}
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {!canUpgrade && (
                    <Alert variant="info" title="Pool is up to date">
                        <p>
                            This pool is already at the latest version supported by your ZFS software.
                        </p>
                    </Alert>
                )}

                {canUpgrade && (
                    <Checkbox
                        id="confirm-irreversible"
                        label="I understand this upgrade is irreversible and may affect compatibility with older ZFS systems"
                        isChecked={confirmIrreversible}
                        onChange={(_, checked) => {
                            setConfirmIrreversible(checked);
                            if (error.dialogError) {
                                setError({});
                            }
                        }}
                    />
                )}
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="upgrade-pool-dialog-confirm"
                    onClick={handleUpgrade}
                    isDisabled={!canUpgrade || !confirmIrreversible || upgrading}
                    isLoading={upgrading}
                >
                    Upgrade Pool
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={upgrading}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default UpgradePoolDialog;

