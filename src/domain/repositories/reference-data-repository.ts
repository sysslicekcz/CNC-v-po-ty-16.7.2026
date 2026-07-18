import { OperationType } from "../entities/operation-type";
import { ToolType } from "../entities/tool-type";
import { Repository } from "./repository";

/** Číselníky - jednoduché agregáty, žádné bohatší chování navíc. */
export type OperationTypeRepository = Repository<OperationType>;
export type ToolTypeRepository = Repository<ToolType>;
