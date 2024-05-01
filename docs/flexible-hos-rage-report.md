# Notes on flexible Higher Order Summoner DAOhaus Apps

**current summoner:** the current factory creates a new instance of Baal. It takes optional loot/shares, Safe and
forwarder addresses. Tokens and Safe are requierd for the deployment so if those addresses are the zeroAddress it will
create a new instances of them. The Safe is setup with the address of the new instance of Baal address as a module. In
the case of the forwarder if it is zeroAddress that functionality is disabled. And finally the Baal instance is
configured with all the address needed.

THis factory has every thing needed to deploy a new "standard" DAO and has enough flexibility to build on top with
higher order summoners (HOS). HOS allows indexors to continue to work with this contracts events but more customations
can happen a layer up

**current Higher Order SUmmoners (HOS):**

Vault summoner: there is a HOS for summoning an extra "side car" vault on a new DAO. in this case the DAO has the main
treasury and a second side vault. This uses the current summoner to summon a DAO and then tack on the deployment of
another safe.

Advanced Token Summoner: this used the ability to send token addresses to the main summoner. It creates and configures
the tokens and then transfers owernship to the DAO

**more flexible Higher Order Sumoner:** the idea here is to have much more flexibility summoner that aligns with some of
the inititives that would like a more complex initial setup.

- that can deploy shares and loot off of any template that adhears to the interface.
- It allows minting of tokens to happen upfront,
- It allows a side vaults to be summond upfront
- it allows a shaman to be configured and added upfront

**Other Considerations:** pause is called on a token in baal setup (pauses tokens by default), that means it probably
needs to exist in the contract even if it does nothing similarly pause/unpause is called in set admin config in baal
contract. paused is also called in set admin config and should return something. in a fixed loot case should return
false

```
/**
     * @dev Summon a new Baal contract with a new set of tokens
     * @param initializationLootTokenParams The parameters for deploying the shares token
     * @param initializationShareTokenParams The parameters for deploying the loot token
     * @param initializationShamanParams  The parameters for deploying the shaman
     * @param postInitializationActions The actions to be performed after the initialization
     */
function summonBaalFromReferrer(
        bytes calldata initializationLootTokenParams,
        bytes calldata initializationShareTokenParams,
        bytes calldata initializationShamanParams,
        bytes[] memory postInitializationActions,
        uint256 saltNounce,
        address safeAddr,
        address forwarder
    )
```

each of thes initialization bytes strings hold the different setup actions for the different initial setups. these
encoded with a template (address) and a furthure encoded string for initialization of these templates as a proxy(tokens)
or minimal proxy clone(shaman)

**deploy tokens:** takes a

```
(address template, bytes memory initParams) = abi.decode(
            initializationParams,
            (address, bytes)
        );

        // ERC1967 could be upgradable
        token = address(
            new ERC1967Proxy(
                template,
                abi.encodeWithSelector(
                    IBaalToken(template).setUp.selector,
                    initParams
                )
            )
        );
```

**deploy shaman:** shamans have a tighter coupling with Baal with the shaman role system. this requires an initial
deploy and then a secondary initialization after the DAO and side vault have been setup

```
// summon shaman (initial deploy)
        // (address template, uint256 permissions, bytes memory initParams)
        (address shamanTemplate, uint256 perm, ) = abi.decode(
            initializationShamanParams,
            (address, uint256, bytes)
        );
        // Clones because it should not need to be upgradable
        shaman = IShaman(payable(Clones.clone(shamanTemplate)));

```

shaman secondary initialization

```
(, , bytes memory initShamanParams) = abi.decode(
            initializationShamanParams,
            (address, uint256, bytes)
        );
        IShaman(shaman).setup(baal, vault, initShamanParams);
```

the DAO (Baal), tresury and vault(Safes) are set up with the current Vault summoner HOS

```
(address baal, address vault) = _baalSummoner.summonBaalAndVault(
            abi.encode(
                IBaalToken(sharesToken).name(),
                IBaalToken(sharesToken).symbol(),
                safeAddr,
                forwarder, // forwarder
                lootToken,
                sharesToken
            ),
            amendedPostInitActions,
            saltNounce, // nonce
            bytes32(bytes("DHFixedLootShamanSummoner")), // referrer
            "sidecar"
        );
```
