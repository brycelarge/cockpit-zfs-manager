import React from 'react';

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { KebabDropdown } from 'cockpit-components-dropdown.jsx';

import { useDialogs } from 'dialogs.jsx';
import CloneSnapshotDialog from './cloneSnapshotDialog.jsx';
import RollbackSnapshotDialog from './rollbackSnapshotDialog.jsx';
import DeleteSnapshotDialog from './deleteSnapshotDialog.jsx';
import ReplicationDialog from './replicationDialog.jsx';

function SnapshotActions({ snapshot, pool, onRefresh }) {
    const Dialogs = useDialogs();

    const dropdownItems = [
        <DropdownItem
            key={`${snapshot.name}-replicate`}
            id={`${snapshot.name}-replicate`}
            onClick={() => Dialogs.show(<ReplicationDialog snapshot={snapshot} pool={pool} onRefresh={onRefresh} />)}
        >
            Replicate
        </DropdownItem>,
        <Divider key={`${snapshot.name}-separator-1`} />,
        <DropdownItem
            key={`${snapshot.name}-clone`}
            id={`${snapshot.name}-clone`}
            onClick={() => Dialogs.show(<CloneSnapshotDialog snapshot={snapshot} pool={pool} onRefresh={onRefresh} />)}
        >
            Clone
        </DropdownItem>,
        <DropdownItem
            key={`${snapshot.name}-rollback`}
            id={`${snapshot.name}-rollback`}
            onClick={() => Dialogs.show(<RollbackSnapshotDialog snapshot={snapshot} pool={pool} onRefresh={onRefresh} />)}
        >
            Rollback
        </DropdownItem>,
        <Divider key={`${snapshot.name}-separator-2`} />,
        <DropdownItem
            key={`${snapshot.name}-delete`}
            id={`${snapshot.name}-delete`}
            className="pf-m-danger"
            onClick={() => Dialogs.show(<DeleteSnapshotDialog snapshot={snapshot} pool={pool} onRefresh={onRefresh} />)}
        >
            Delete
        </DropdownItem>
    ];

    return (
        <div className="btn-group">
            <KebabDropdown
                toggleButtonId={`${snapshot.name}-action-kebab`}
                position="right"
                dropdownItems={dropdownItems}
            />
        </div>
    );
}

export default SnapshotActions;

