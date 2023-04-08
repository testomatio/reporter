
type KeyValueObject = { [key: string]: string };

// this class is singletone
class ClientStore {
  private static instance: ClientStore;

  keyValueProps: KeyValueObject = {};

  private constructor() { };

  get properties() {
    return this.keyValueProps;
  }

  clear() {
    this.keyValueProps = {};
  }

  static getInstance(): ClientStore {
    if (!ClientStore.instance) {
      ClientStore.instance = new ClientStore();
    }

    return ClientStore.instance;
  }
}

export const clientStore = ClientStore.getInstance();



// this class created to hide some Store methods from the user
export default class PublicUserStore {
  clientStore: ClientStore;

  constructor() {
    this.clientStore = ClientStore.getInstance();
  }

  /**
   * Allows you to set properties to your test
   * @param key string
   * @param value string
   */
  static property(key: string, value: string) {
    clientStore.keyValueProps[key] = String(value);
  }

  // step() {}
}



// export const reporter = new PublicUserStore();


// export default ClientStore.getInstance();

// const a = ClientStore.getInstance();