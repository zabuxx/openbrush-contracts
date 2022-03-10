#![feature(min_specialization)]
#[cfg(feature = "proxy")]
#[brush::contract]
mod proxy {
    use brush::test_utils::change_caller;
    use contracts::{
        ownable::*, 
        proxy::*
    };
    use ink::codegen::{
        EmitEvent,
        Env,
    };
    use ink_lang as ink;

    #[ink(event)]
    pub struct CodeHashChanged {
        #[ink(topic)]
        previous_code_hash: Option<Hash>,
        #[ink(topic)]
        new_code_hash: Option<Hash>,
    }

    const CODE_HASH_0: [u8; 32] = [0u8; 32];
    const CODE_HASH_1: [u8; 32] = [1u8; 32];

    #[ink(storage)]
    #[derive(Default, OwnableStorage, ProxyStorage)]
    pub struct MyProxy {
        #[OwnableStorageField]
        ownable: OwnableData,
        #[ProxyStorageField]
        proxy: ProxyData,
    }

    type Event = <MyProxy as ::ink_lang::reflect::ContractEventBase>::Type;

    impl MyProxy {
        #[ink(constructor)]
        pub fn new(forward_to: Hash) -> Self {
            let mut inst = Self::default();
            inst._init_with_forward_to(Hash::try_from(forward_to).unwrap());
            inst._init_with_owner(Self::env().caller());
            inst
        }
    }

    impl Proxy for MyProxy {}

    impl ProxyInternal for MyProxy {
        default fn _emit_delegate_code_changed_event(
            &self,
            previous_code_hash: Option<Hash>,
            new_code_hash: Option<Hash>
        ) {
            self.env().emit_event(CodeHashChanged {
                previous_code_hash,
                new_code_hash,
            })
        }
    }

    fn assert_code_changed_event(
        event: &ink_env::test::EmittedEvent,
        expected_previous_code_hash: Option<Hash>,
        expected_new_code_hash: Option<Hash>,
    ) {
        let Event::CodeHashChanged(CodeHashChanged {
            previous_code_hash,
            new_code_hash,
        }) = <Event as scale::Decode>::decode(&mut &event.data[..])
            .expect("encountered invalid contract event data buffer");

        assert_eq!(
            previous_code_hash, expected_previous_code_hash,
            "Previous code hash was not equal to expected previous code hash."
        );
        assert_eq!(
            new_code_hash, expected_new_code_hash,
            "New code hash was not equal to expected new code hash."
        );
    }

    #[ink::test]
    fn constructor_works() {
        let hash = Hash::try_from(CODE_HASH_0).unwrap();
        let instance = MyProxy::new(hash);

        let emitted_events = ink_env::test::recorded_events().collect::<Vec<_>>();
        assert_eq!(1, emitted_events.len());

        assert_code_changed_event(&emitted_events[0], None, Some(instance.get_delegate_code()))
    }

    #[ink::test]
    fn get_delegate_code_works() {
        let hash = Hash::try_from(CODE_HASH_0).unwrap();
        let my_proxy = MyProxy::new(hash);
        assert_eq!(my_proxy.get_delegate_code(), hash)
    }

    #[ink::test]
    fn change_delegate_code_works() {
        let hash = Hash::try_from(CODE_HASH_0).unwrap();
        let new_hash = Hash::try_from(CODE_HASH_1).unwrap();
        let mut my_proxy = MyProxy::new(hash);
        my_proxy.change_delegate_code(new_hash);
        assert_eq!(my_proxy.get_delegate_code(), new_hash);
        let emitted_events = ink_env::test::recorded_events().collect::<Vec<_>>();
        assert_eq!(2, emitted_events.len());
        assert_code_changed_event(&emitted_events[0], None, Some(hash));
        assert_code_changed_event(&emitted_events[1], Some(hash), Some(new_hash));
    }

    #[ink::test]
    fn change_delegate_code_fails() {
        let hash = Hash::try_from(CODE_HASH_0).unwrap();
        let new_hash = Hash::try_from(CODE_HASH_1).unwrap();
        let mut my_proxy = MyProxy::new(hash);
        change_caller(AccountId::from([0x13; 32]));
        let result = my_proxy.change_delegate_code(new_hash);
        assert!(result.is_err());
        assert_eq!(result, Err(ProxyError::from(OwnableError::CallerIsNotOwner)));
    }
}
