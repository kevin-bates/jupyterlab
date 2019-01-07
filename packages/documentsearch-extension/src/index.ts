/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/
import '../style/index.css';

import { SearchBox } from './searchbox';
import { Executor } from './executor';
import { SearchProviderRegistry } from './searchproviderregistry';

import { JupyterLab, JupyterLabPlugin } from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';

import { ISignal } from '@phosphor/signaling';

export interface ISearchMatch {
  /**
   * Text of the exact match itself
   */
  readonly text: string;

  /**
   * Fragment containing match
   */
  readonly fragment: string;

  /**
   * Line number of match
   */
  line: number;

  /**
   * Column location of match
   */
  column: number;

  /**
   * Index among the other matches
   */
  index: number;
}

export interface ISearchProvider {
  /**
   * Initialize the search using the provided options.  Should update the UI
   * to highlight all matches and "select" whatever the first match should be.
   *
   * @param options All of the search parameters configured in the search panel
   *
   * @returns A promise that resolves with a list of all matches
   */
  startSearch(query: RegExp, searchTarget: any): Promise<ISearchMatch[]>;

  /**
   * Resets UI state, removes all matches.
   *
   * @returns A promise that resolves when all state has been cleaned up.
   */
  endSearch(): Promise<void>;

  /**
   * Move the current match indicator to the next match.
   *
   * @returns A promise that resolves once the action has completed.
   */
  highlightNext(): Promise<ISearchMatch>;

  /**
   * Move the current match indicator to the previous match.
   *
   * @returns A promise that resolves once the action has completed.
   */
  highlightPrevious(): Promise<ISearchMatch>;

  /**
   * Report whether or not this provider has the ability to search on the given object
   */
  canSearchOn(domain: any): boolean;

  /**
   * The same list of matches provided by the startSearch promise resoluton
   */
  readonly matches: ISearchMatch[];

  /**
   * Signal indicating that something in the search has changed, so the UI should update
   */
  readonly changed: ISignal<ISearchProvider, void>;

  /**
   * The current index of the selected match.
   */
  readonly currentMatchIndex: number;
}

/**
 * Initialization data for the document-search extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: '@jupyterlab/documentsearch:plugin',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (app: JupyterLab, palette: ICommandPalette) => {
    // Create registry, retrieve all default providers
    const registry: SearchProviderRegistry = new SearchProviderRegistry();
    const executor: Executor = new Executor(registry, app.shell);

    // Create widget, attach to signals
    const widget: SearchBox = new SearchBox();

    const updateWidget = () => {
      widget.totalMatches = executor.matches.length;
      widget.currentIndex = executor.currentMatchIndex;
    };

    const startSearchFn = (_: any, searchOptions: any) => {
      executor.startSearch(searchOptions).then(() => {
        updateWidget();
        executor.changed.connect(updateWidget);
      });
    };

    const endSearchFn = () => {
      executor.endSearch().then(() => {
        widget.totalMatches = 0;
        widget.currentIndex = 0;
        executor.changed.disconnect(updateWidget);
      });
    };

    const highlightNextFn = () => {
      executor.highlightNext().then(updateWidget);
    };

    const highlightPreviousFn = () => {
      executor.highlightPrevious().then(updateWidget);
    };

    // Default to just searching on the current widget, could eventually
    // read a flag provided by the search box widget if we want to search something else
    widget.startSearch.connect(startSearchFn);
    widget.endSearch.connect(endSearchFn);
    widget.highlightNext.connect(highlightNextFn);
    widget.highlightPrevious.connect(highlightPreviousFn);

    const startCommand: string = 'documentsearch:start';
    const nextCommand: string = 'documentsearch:highlightNext';
    const prevCommand: string = 'documentsearch:highlightPrevious';
    app.commands.addCommand(startCommand, {
      label: 'Search the open document',
      execute: () => {
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.addToLeftArea(widget, { rank: 400 });
        }
        app.shell.activateById(widget.id);
      }
    });

    app.commands.addCommand(nextCommand, {
      label: 'Search the open document',
      execute: highlightNextFn
    });

    app.commands.addCommand(prevCommand, {
      label: 'Search the open document',
      execute: highlightPreviousFn
    });

    // Add the command to the palette.
    palette.addItem({ command: startCommand, category: 'Tutorial' });
  }
};

export default extension;
