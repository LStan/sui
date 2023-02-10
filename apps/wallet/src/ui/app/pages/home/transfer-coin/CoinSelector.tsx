// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SUI_TYPE_ARG } from '@mysten/sui.js';
import {
    WalletActionStake24,
    ArrowRight16,
    Info16,
    Swap16,
} from '@mysten/icons';
import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import ActiveCoinsCard from '_components/active-coins-card';
import { SuiIcons } from '_components/icon';
import Overlay from '_components/overlay';

function CoinsSelectorPage() {
    const [searchParams] = useSearchParams();
    const [showModal, setShowModal] = useState(true);
    const coinType = searchParams.get('type') || SUI_TYPE_ARG;
    const navigate = useNavigate();

    const closeReceipt = useCallback(() => {
        navigate(
            `/send?${new URLSearchParams({
                type: coinType,
            }).toString()}`
        );
    }, [coinType, navigate]);

    return (
        <Overlay
            showModal={showModal}
            setShowModal={setShowModal}
            title="Select Coin"
            closeOverlay={closeReceipt}
            closeIcon={SuiIcons.Check}
        >
            <ActiveCoinsCard activeCoinType={coinType} showActiveCoin={false} />
        </Overlay>
    );
}

export default CoinsSelectorPage;
