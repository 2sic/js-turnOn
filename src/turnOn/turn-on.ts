import { ConditionMaker, IsLoaded, Settings, Status, ConditionRaw, DefaultSettings, LogDebug, LogSilent, StatusSummary } from '.';
import { FailReject, FailResolve, FailSilent } from './settings';
import { promiseBoolToStatus } from './promise-boolean-to-status';
export class TurnOn {

  /** The settings applied to this turnOn */
  public settings = new Settings();

  /** Constructor with optional settings */
  constructor(nameOrSettings?: Partial<Settings> | string) {
    if (typeof nameOrSettings === 'string') {
      nameOrSettings = {
        name: nameOrSettings
      };
    }

    if (nameOrSettings)
      this.settings = { ...this.settings, ...nameOrSettings };

    TurnOn.count++;
  }

  /**
   * Create a new turnOn object.
   * Mainly usefuly in global scenarios, to give it a separate name
   */
  new(nameOrSettings?: Partial<Settings>) {
    return new TurnOn(nameOrSettings);
  }

  public await(conditions: ConditionRaw | ConditionRaw[]): Promise<Status> {

    // re-wrap to ensure we always work with an array
    const conditionsArray = (Array.isArray(conditions)) ? conditions : [conditions];

    // convert conditions to promises
    const loadedCheckers = conditionsArray.map(c => {
      // do this for non-promise conditions
      if (Promise.resolve(c as unknown) === c) {
        return promiseBoolToStatus(c);
      } else {
        const condition = this._conditionMaker.make(c);
        var loaded = new IsLoaded(condition, this.settings);
        return loaded.asPromise();  
      }
    });

    // keep the current turnOn-object for reference in methods
    const thisKs = this;

    // keep count as it was on start, to ensure it doesn't change any more till we log the error
    const instanceCount = TurnOn.count;

    let flattened = new Promise<StatusSummary>((resolve, reject) => { 
      // return a single promise for all inner promises which either fail or resolve
      Promise.all(loadedCheckers).then(list => {

        // get summary of all details infos
        var summary = new StatusSummary(list);

        // by default, log details about what failed
        if (thisKs.settings.log === LogDebug || (!summary.ready && thisKs.settings.log !== LogSilent))
          thisKs.logStatusList(instanceCount, thisKs.settings, list);

        // if all is ok, resolve now
        if (summary.ready) {
          resolve(new StatusSummary(list));
          return;
        }

        // depending on the need, either reject/error (default) or resolve with false
        switch (thisKs.settings.failure){
          case FailReject: reject(summary);
          case FailResolve: resolve(summary);
          case FailSilent: return;
        }
      })
    });
      
    return flattened;
  }

  public logStatusList(id: number, settings: Settings, statusList: Status[]) {
    console.log(`turnOn #${id} `
    + (settings.name !== DefaultSettings.name ? `"${settings.name}" ` : '')
    + `couldn't complete because some conditions were not met. See details: `, statusList);
  }

  private _conditionMaker = new ConditionMaker();

  private static count = 0;
}